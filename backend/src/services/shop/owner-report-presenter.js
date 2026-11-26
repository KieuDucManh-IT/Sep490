const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const AVAILABILITY = ['AVAILABLE', 'PARTIAL', 'UNAVAILABLE'];
const REASONS = ['EVENT_TIME_MISSING', 'EVENT_LINK_MISSING', 'SOURCE_COVERAGE_INCOMPLETE', 'INVALID_AMOUNT', 'INVENTORY_SOURCE_CONFLICT'];
/** @ears .sdd/features/shop-owner-analytics/SPEC.md#NFR-SOA-003 */
const integer = (value) => typeof value === 'bigint' ? (value >= 0n && value <= MAX ? value : null)
  : Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017 */
const reason = (value) => REASONS.includes(value) ? value : 'SOURCE_COVERAGE_INCOMPLETE';

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
export function createReportMetric(value, { availability = 'AVAILABLE', reasonCode } = {}) {
  const amount = integer(value);
  const status = amount === null || !AVAILABILITY.includes(availability) ? 'UNAVAILABLE' : availability;
  return { value: status === 'UNAVAILABLE' ? null : Number(amount), availability: status,
    ...(status === 'AVAILABLE' ? {} : { reasonCode: reason(reasonCode || (value != null && amount === null ? 'INVALID_AMOUNT' : undefined)) }) };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
export function sumIntegerVnd(values) {
  if (!Array.isArray(values)) return createReportMetric(null);
  let sum = 0n;
  for (const value of values) {
    const amount = integer(value);
    if (amount === null || (sum += amount) > MAX) return createReportMetric(null, { reasonCode: 'INVALID_AMOUNT' });
  }
  return createReportMetric(sum);
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#NFR-SOA-003 */
function roundedPercent(numerator, denominator) {
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const cents = (magnitude * 10000n + denominator / 2n) / denominator;
  if (cents > MAX) return null;
  const text = `${negative && cents !== 0n ? '-' : ''}${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
  return Number(text); // JSON representation only; all ratio/rounding arithmetic above is integer.
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
export function calculatePercentChange(current, baseline) {
  const currentValue = integer(current?.value);
  const baselineValue = integer(baseline?.value);
  if (current?.availability !== 'AVAILABLE' || baseline?.availability !== 'AVAILABLE' || currentValue === null || baselineValue === null || baselineValue <= 0n) {
    return { changePercent: null, hasGrowthBaseline: false };
  }
  const changePercent = roundedPercent(currentValue - baselineValue, baselineValue);
  return { changePercent, hasGrowthBaseline: changePercent !== null };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-016 */
export function calculateReturningRate(returning, unique) {
  const count = integer(returning);
  const total = integer(unique);
  return count === null || total === null || total === 0n || count > total ? null : roundedPercent(count, total);
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
const amount = (value) => { const parsed = integer(value); return parsed === null ? null : Number(parsed); };
/** @ears .sdd/features/shop-owner-analytics/SPEC.md#NFR-SOA-003 */
const percent = (value) => typeof value === 'number' && Number.isFinite(value) && /^-?\d+(\.\d{1,2})?$/.test(String(value)) ? value : null;
const flag = (value) => typeof value === 'boolean' ? value : null;
const text = (value) => typeof value === 'string' ? value : null;
const id = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value) ? value.toLowerCase() : null;
const timestamp = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const availability = (value) => AVAILABILITY.includes(value) ? value : 'UNAVAILABLE';
const META = { availability, reasonCode: reason };
const MONEY = { rental: amount, sales: amount, total: amount };
const METRICS = {
  orderValue: MONEY, successfulCollections: { ...MONEY, ...META },
  completedRefundOutflows: { total: amount, rental: amount, sales: amount, deposit: amount, ...META },
  heldDepositsSnapshot: amount, orders: MONEY,
  customers: { unique: amount, new: amount, returning: amount, returningRate: percent, ...META },
};
const LABEL = { shopId: id, name: text, status: (value) => ['ACTIVE', 'SUSPENDED'].includes(value) ? value : null, isHQ: flag };
const INVENTORY = { available: amount, renting: amount, reserved: amount, maintenance: amount, unavailable: amount, inTransit: amount, ...META };
const PRODUCT = { productId: id, name: text, quantity: amount, orderCount: amount, orderValue: amount, ...META };
const OPERATIONS = { overdue: amount, upcomingReturns: amount, inspection: amount, openDisputes: amount, pendingHandover: amount, incomingTransfers: amount, failedShipments: amount, ...META };
const TIME = { preset: (value) => ['TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'].includes(value) ? value : null,
  startAt: timestamp, endAtExclusive: timestamp, comparisonStartAt: timestamp, comparisonEndAtExclusive: timestamp };

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017 */
function metricPaths(schema, prefix = '') {
  return Object.entries(schema).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'function' ? [path] : [path, ...metricPaths(value, path)];
  });
}
const PATHS = new Set([...metricPaths(METRICS), 'series', 'storeInventoryByBranch', 'centralWarehouseInventory', 'topRentalProducts', 'topSalesProducts', 'slowMovingProducts', 'operationsByBranch']);
for (const path of [...PATHS]) { PATHS.add(`metrics.${path}`); PATHS.add(`comparisonMetrics.${path}`); }

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017 */
function pick(value, schema) {
  if (value === undefined) return undefined;
  if (typeof schema === 'function') return schema(value);
  if (Array.isArray(schema)) return Array.isArray(value) ? value.map((row) => pick(row, schema[0])) : null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(schema).filter(([key]) => Object.hasOwn(value, key)).map(([key, child]) => [key, pick(value[key], child)]));
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017 */
function metricMap(value, schema) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => PATHS.has(key)).map(([key, entry]) => [key, pick(entry, schema)]));
}
const changes = (value) => metricMap(value, percent);
const baselines = (value) => metricMap(value, flag);
const metadata = (value) => metricMap(value, META);
const BREAKDOWN = {
  rental: Object.fromEntries(['draft', 'confirmed', 'renting', 'partially_returned', 'returned', 'cancelled', 'overdue'].map((key) => [key, amount])),
  sales: Object.fromEntries(['draft', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'].map((key) => [key, amount])),
};
const DATA = {
  metrics: METRICS, comparisonMetrics: METRICS, changePercent: changes, hasGrowthBaseline: baselines, orderStatusBreakdown: BREAKDOWN,
  series: [{ startAt: timestamp, endAtExclusive: timestamp, label: text, orderValue: MONEY, successfulCollections: { ...MONEY, ...META },
    completedRefundOutflows: { total: amount, ...META }, orders: MONEY, metricAvailability: metadata }],
  branches: [{ ...LABEL, metrics: METRICS, comparisonMetrics: METRICS, changePercent: changes, hasGrowthBaseline: baselines, metricAvailability: metadata }],
  storeInventoryByBranch: [{ shopId: id, ...INVENTORY }], centralWarehouseInventory: INVENTORY,
  topRentalProducts: [PRODUCT], topSalesProducts: [PRODUCT], slowMovingProducts: [{ productId: id, name: text, availableQuantity: amount, ...META }],
  operationsByBranch: [{ shopId: id, ...OPERATIONS }], metricAvailability: metadata,
};

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function normalizeMetricAvailability(projected) {
  const notes = projected.metricAvailability || {};
  for (const namespace of ['metrics', 'comparisonMetrics']) {
    for (const [key, schema] of Object.entries(METRICS)) {
      const entry = projected[namespace]?.[key];
      if (entry === undefined) continue;
      const path = namespace === 'metrics' ? key : `${namespace}.${key}`;
      const fields = typeof schema === 'function' ? [] : Object.keys(schema).filter((field) => schema[field] === amount);
      const required = key === 'completedRefundOutflows' ? ['total'] : fields;
      const invalidAmount = entry === null || required.some((field) => !Object.hasOwn(entry, field) || entry[field] === null);
      const known = entry !== null && fields.some((field) => typeof entry[field] === 'number');
      const declared = entry?.availability || notes[path]?.availability;
      const status = declared === 'UNAVAILABLE' ? 'UNAVAILABLE' : invalidAmount ? (known ? 'PARTIAL' : 'UNAVAILABLE') : declared;
      if (!status || status === 'AVAILABLE') continue;
      const reasonCode = reason(entry?.reasonCode || notes[path]?.reasonCode);
      notes[path] = { availability: status, reasonCode };
      if (entry && typeof entry === 'object') {
        if (Object.hasOwn(schema, 'availability')) Object.assign(entry, { availability: status, reasonCode });
        if (status === 'UNAVAILABLE') {
          for (const field of Object.keys(schema)) if (Object.hasOwn(entry, field) && (schema[field] === amount || schema[field] === percent)) entry[field] = null;
        }
      } else if (status === 'UNAVAILABLE') projected[namespace][key] = null;
    }
  }
  if (Object.keys(notes).length) projected.metricAvailability = notes;
}

/**
 * Only canonical scope and clock from the service may provide headers; caller
 * payload cannot override them. Missing metrics stay missing/null, never zero.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017
 */
export function presentOwnerPerformanceReport(data, { scope, window }) {
  const branches = (pick(scope.shops, [LABEL]) || []).filter((branch) => branch?.shopId);
  const owned = new Set(branches.map((branch) => branch.shopId));
  const projected = owned.size ? pick(data, DATA) || {}
    : Object.fromEntries(Object.entries(DATA).map(([key, schema]) => [key, Array.isArray(schema) ? [] : {}]));
  normalizeMetricAvailability(projected);
  for (const key of ['branches', 'storeInventoryByBranch', 'operationsByBranch']) {
    if (Array.isArray(projected[key])) projected[key] = projected[key].filter((row) => owned.has(row?.shopId));
  }
  for (const branch of projected.branches || []) normalizeMetricAvailability(branch);
  for (const point of projected.series || []) {
    const box = { metrics: point, metricAvailability: point?.metricAvailability };
    normalizeMetricAvailability(box);
    if (box.metricAvailability && point) point.metricAvailability = box.metricAvailability;
  }
  return { success: true, data: { ...projected, generatedAt: timestamp(window.generatedAt), currency: 'VND',
    scope: { hasBranches: branches.length > 0, branches }, timeRange: pick(window, TIME) } };
}
