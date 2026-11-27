import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { buildOwnerReportBuckets } from './owner-report-time-window.js';
import { createReportMetric, sumIntegerVnd } from './owner-report-presenter.js';

const STATES = { rental: ['draft', 'confirmed', 'renting', 'partially_returned', 'returned', 'cancelled', 'overdue'], sales: ['draft', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'] };
const sourceError = () => Object.assign(new Error('Nguồn báo cáo đơn không khả dụng.'), { statusCode: 500, code: 'ERR_OWNER_REPORT_SOURCE' });
const safe = (value) => Number.isSafeInteger(value) && value >= 0;
const emptyCell = () => ({ count: 0n, value: 0n, known: 0n, bad: 0n, dates: 0n, unknown: 0n });
const emptySummary = () => ({ rental: emptyCell(), sales: emptyCell(), statuses: Object.fromEntries(Object.entries(STATES).map(([channel, states]) => [channel, Object.fromEntries(states.map((state) => [state, 0n]))])) });

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-007 */
export function ownerOrderPipeline(scope, window, channel) {
  const field = channel === 'rental' ? 'rentalFee' : 'totalAmount';
  const state = channel === 'rental' ? 'rentalStatus' : 'orderStatus';
  const currentBuckets = buildOwnerReportBuckets(window);
  const cases = [...currentBuckets, ...buildOwnerReportBuckets(window, { comparison: true })].map((bucket, index) => ({
    case: { $and: [{ $gte: ['$createdAt', new Date(bucket.startAt)] }, { $lt: ['$createdAt', new Date(bucket.endAtExclusive)] }] },
    then: index < currentBuckets.length ? index : index - currentBuckets.length,
  }));
  const amount = `$${field}`;
  const valid = { $cond: [{ $in: [{ $type: amount }, ['double', 'int', 'long', 'decimal']] },
    { $and: [{ $gte: [amount, 0] }, { $lte: [amount, Number.MAX_SAFE_INTEGER] }, { $eq: [{ $mod: [amount, 1] }, 0] }] }, false] };
  return [{ $match: { locationId: { $in: scope.locationIds.map((id) => new RentalOrder.base.Types.ObjectId(id)) } } }, { $facet: {
    rows: [{ $match: { createdAt: { $gte: new Date(window.comparisonStartAt), $lt: new Date(window.endAtExclusive) } } },
      { $project: { locationId: 1, status: `$${state}`, period: { $cond: [{ $gte: ['$createdAt', new Date(window.startAt)] }, 'current', 'comparison'] },
        bucket: { $switch: { branches: cases, default: -1 } }, value: { $cond: [valid, amount, 0] }, invalidAmounts: { $cond: [valid, 0, 1] } } },
      { $group: { _id: { locationId: '$locationId', status: '$status', period: '$period', bucket: '$bucket' }, count: { $sum: 1 }, value: { $sum: '$value' }, invalidAmounts: { $sum: '$invalidAmounts' } } }],
    dateGaps: [{ $match: { $expr: { $ne: [{ $type: '$createdAt' }, 'date'] } } }, { $group: { _id: '$locationId', count: { $sum: 1 } } }],
  } }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-007 */
function addRow(summary, row, channel) {
  if (!safe(row.count)) throw sourceError();
  const count = BigInt(row.count);
  const cell = summary[channel];
  if (!STATES[channel].includes(row._id.status)) { cell.unknown += count; return; }
  summary.statuses[channel][row._id.status] += count;
  if (['draft', 'cancelled'].includes(row._id.status)) return;
  cell.count += count;
  if (!safe(row.value) || !safe(row.invalidAmounts) || row.invalidAmounts > row.count) { cell.bad += count; return; }
  cell.value += BigInt(row.value);
  cell.bad += BigInt(row.invalidAmounts);
  cell.known += count - BigInt(row.invalidAmounts);
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function cellMetric(cell, money) {
  const missing = cell.dates + cell.unknown + (money ? cell.bad : 0n);
  const known = money ? cell.known : cell.count;
  const availability = missing ? known ? 'PARTIAL' : 'UNAVAILABLE' : 'AVAILABLE';
  const reasonCode = cell.dates ? 'EVENT_TIME_MISSING' : cell.bad && money ? 'INVALID_AMOUNT' : 'SOURCE_COVERAGE_INCOMPLETE';
  return createReportMetric(money ? cell.value : cell.count, { availability, reasonCode });
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function combine(rental, sales) {
  const values = [rental.value, sales.value].filter((value) => value !== null);
  const metric = values.length ? sumIntegerVnd(values) : createReportMetric(null);
  const availability = rental.availability === 'AVAILABLE' && sales.availability === 'AVAILABLE' ? 'AVAILABLE' : values.length ? 'PARTIAL' : 'UNAVAILABLE';
  return createReportMetric(metric.value, { availability, reasonCode: rental.reasonCode || sales.reasonCode || metric.reasonCode });
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-007 */
function presentSummary(summary) {
  const metrics = {}, metricAvailability = {};
  for (const [key, money] of [['orderValue', true], ['orders', false]]) {
    const rental = cellMetric(summary.rental, money), sales = cellMetric(summary.sales, money), total = combine(rental, sales);
    metrics[key] = { rental: rental.value, sales: sales.value, total: total.value };
    for (const [path, metric] of [[key, total], [`${key}.rental`, rental], [`${key}.sales`, sales]]) {
      metricAvailability[path] = { availability: metric.availability, ...(metric.reasonCode ? { reasonCode: metric.reasonCode } : {}) };
    }
  }
  const orderStatusBreakdown = Object.fromEntries(Object.entries(summary.statuses).map(([channel, states]) => [channel, Object.fromEntries(Object.entries(states).map(([state, count]) => [state, createReportMetric(count).value]))]));
  return { metrics, metricAvailability, orderStatusBreakdown };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003 */
export function reduceOwnerOrderAggregates(results, scope, window) {
  const periods = { current: emptySummary(), comparison: emptySummary() };
  const branch = new Map(scope.shops.map((shop) => [shop.shopId, { current: emptySummary(), comparison: emptySummary() }]));
  const buckets = buildOwnerReportBuckets(window), series = buckets.map(() => emptySummary());
  for (const channel of ['rental', 'sales']) {
    const result = results[channel];
    if (!result || !Array.isArray(result.rows) || !Array.isArray(result.dateGaps)) throw sourceError();
    for (const row of result.rows) {
      const location = scope.locationById.get(String(row._id?.locationId));
      if (!location || !branch.has(location.shopId)) continue;
      if (!['current', 'comparison'].includes(row._id.period)) throw sourceError();
      const targets = [periods[row._id.period], branch.get(location.shopId)[row._id.period]];
      if (row._id.period === 'current') { if (!Number.isInteger(row._id.bucket) || row._id.bucket < 0 || row._id.bucket >= series.length) throw sourceError(); targets.push(series[row._id.bucket]); }
      for (const target of targets) addRow(target, row, channel);
    }
    for (const gap of result.dateGaps) {
      const location = scope.locationById.get(String(gap._id));
      if (!location || !branch.has(location.shopId)) continue;
      if (!safe(gap.count)) throw sourceError();
      for (const target of [...Object.values(periods), ...Object.values(branch.get(location.shopId)), ...series]) target[channel].dates += BigInt(gap.count);
    }
  }
  return { current: presentSummary(periods.current), comparison: presentSummary(periods.comparison),
    branches: [...branch].map(([shopId, periods]) => ({ shopId, current: presentSummary(periods.current), comparison: presentSummary(periods.comparison) })),
    series: series.map((summary, index) => { const result = presentSummary(summary); return { ...buckets[index], ...result.metrics, metricAvailability: result.metricAvailability }; }) };
}

/**
 * Database-side grouping returns bounded summaries, never the individual order rows.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-007
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-012
 */
export async function queryOwnerOrders({ scope, window }, { RentalModel = RentalOrder, SalesModel = SalesOrder } = {}) {
  const empty = { rental: { rows: [], dateGaps: [] }, sales: { rows: [], dateGaps: [] } };
  if (!scope.locationIds.length) return reduceOwnerOrderAggregates(empty, scope, window);
  const [rental, sales] = await Promise.all([RentalModel.aggregate(ownerOrderPipeline(scope, window, 'rental')), SalesModel.aggregate(ownerOrderPipeline(scope, window, 'sales'))]);
  return reduceOwnerOrderAggregates({ rental: rental[0], sales: sales[0] }, scope, window);
}
