import mongoose from 'mongoose';
import { resolveOwnerReportScope } from './owner-report-scope-query.js';
import { validateOwnerPerformanceQuery } from '../../validations/shop/owner-performance-validation.js';
import { resolveOwnerReportTimeWindow, buildOwnerReportBuckets } from './owner-report-time-window.js';
import { presentOwnerPerformanceReport, createReportMetric, calculatePercentChange } from './owner-report-presenter.js';
import { queryOwnerOrders } from './owner-report-order-query.js';
import { queryOwnerFinance } from './owner-report-finance-query.js';
import { queryOwnerInventory } from './owner-report-inventory-query.js';
import { queryOwnerProducts } from './owner-report-product-query.js';
import { queryOwnerOperations } from './owner-report-operations-query.js';
import { queryOwnerCustomers } from './owner-report-customer-query.js';
const error = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });
const sourceError = () => error(500, 'ERR_OWNER_REPORT_SOURCE', 'Không thể tải báo cáo chủ shop.');
const object = (value) => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw sourceError(); return value; };
const array = (value) => { if (!Array.isArray(value)) throw sourceError(); return value; };
const QUERIES = { orders: queryOwnerOrders, finance: queryOwnerFinance, inventory: queryOwnerInventory, products: queryOwnerProducts, operations: queryOwnerOperations, customers: queryOwnerCustomers };
const SAFE_ERRORS = {
  ERR_UNAUTHENTICATED: [401, 'Bạn cần đăng nhập để xem báo cáo.'],
  ERR_OWNER_REPORT_FORBIDDEN: [403, 'Bạn không có quyền xem báo cáo chủ shop.'],
  ERR_OWNER_REPORT_QUERY: [400, 'Bộ lọc báo cáo không hợp lệ.'],
  ERR_OWNER_REPORT_TIME: [500, 'Không thể xác minh thời điểm báo cáo.'],
};

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-002 */
function requireOwner(user) {
  if (!mongoose.isObjectIdOrHexString(user?._id)) throw error(401, 'ERR_UNAUTHENTICATED', 'Bạn cần đăng nhập để xem báo cáo.');
  const role = String(user?.Role || user?.role || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (!['shopowner', 'owner'].includes(role)) throw error(403, 'ERR_OWNER_REPORT_FORBIDDEN', 'Bạn không có quyền xem báo cáo chủ shop.');
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function period(order, finance, customer) {
  const metrics = { ...object(order?.metrics), ...object(finance?.metrics), ...(customer ? object(customer.metrics) : {}) };
  for (const key of ['orderValue', 'orders', 'successfulCollections', 'completedRefundOutflows']) object(metrics[key]);
  const metricAvailability = { ...object(order.metricAvailability), ...object(finance.metricAvailability) };
  if (customer) metricAvailability.customers = { availability: object(metrics.customers).availability, reasonCode: metrics.customers.reasonCode };
  return { metrics, metricAvailability };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function growth(current, comparison) {
  const fields = { orderValue: ['rental', 'sales', 'total'], orders: ['rental', 'sales', 'total'], successfulCollections: ['rental', 'sales', 'total'], completedRefundOutflows: ['total'], customers: ['unique', 'new', 'returning'] };
  const changePercent = {}, hasGrowthBaseline = {};
  for (const [key, children] of Object.entries(fields)) for (const child of children) {
    const path = `${key}.${child}`;
    const metric = (box) => createReportMetric(box.metrics[key]?.[child], { availability: box.metricAvailability[path]?.availability || box.metricAvailability[key]?.availability || box.metrics[key]?.availability || 'AVAILABLE' });
    const result = calculatePercentChange(metric(current), metric(comparison));
    changePercent[path] = result.changePercent; hasGrowthBaseline[path] = result.hasGrowthBaseline;
    if (child === 'total' || (key === 'customers' && child === 'unique')) { changePercent[key] = result.changePercent; hasGrowthBaseline[key] = result.hasGrowthBaseline; }
  }
  return { changePercent, hasGrowthBaseline };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-011 */
function snapshot(current, deposit) {
  object(deposit);
  const metric = createReportMetric(deposit.value, { availability: deposit.availability, reasonCode: deposit.reasonCode });
  current.metrics.heldDepositsSnapshot = metric.value;
  current.metricAvailability.heldDepositsSnapshot = { availability: metric.availability, ...(metric.reasonCode ? { reasonCode: metric.reasonCode } : {}) };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function comparisons(current, comparison) {
  return { metrics: current.metrics, comparisonMetrics: comparison.metrics, ...growth(current, comparison),
    metricAvailability: { ...current.metricAvailability, ...Object.fromEntries(Object.entries(comparison.metricAvailability).map(([key, value]) => [`comparisonMetrics.${key}`, value])) } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-012 */
function branches(sources, scope) {
  const orders = new Map(array(sources.orders.branches).map((row) => [row.shopId, row]));
  const finance = new Map(array(sources.finance.branches).map((row) => [row.shopId, row]));
  return scope.shops.map((shop) => {
    const order = orders.get(shop.shopId), money = finance.get(shop.shopId);
    const current = period(order?.current, money?.current), comparison = period(order?.comparison, money?.comparison);
    snapshot(current, money.heldDepositsSnapshot);
    return { ...shop, ...comparisons(current, comparison) };
  });
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
function series(sources, window) {
  const buckets = buildOwnerReportBuckets(window);
  const maps = ['orders', 'finance'].map((source) => {
    const points = array(sources[source].series), mapped = new Map(points.map((point) => [point.startAt, point]));
    if (points.length !== buckets.length || mapped.size !== points.length) throw sourceError();
    return mapped;
  });
  return buckets.map((bucket) => {
    const [order, money] = maps.map((map) => map.get(bucket.startAt));
    if (!order || !money || order.endAtExclusive !== bucket.endAtExclusive || money.endAtExclusive !== bucket.endAtExclusive) throw sourceError();
    return { ...bucket, orderValue: object(order.orderValue), orders: object(order.orders), successfulCollections: object(money.successfulCollections),
      completedRefundOutflows: object(money.completedRefundOutflows), metricAvailability: { ...object(order.metricAvailability), ...object(money.metricAvailability) } };
  });
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017 */
function assemble(sources, context) {
  const current = period(sources.orders.current, sources.finance.current, sources.customers.current);
  const comparison = period(sources.orders.comparison, sources.finance.comparison, sources.customers.comparison);
  snapshot(current, sources.finance.heldDepositsSnapshot);
  const report = comparisons(current, comparison);
  return { ...report, orderStatusBreakdown: object(sources.orders.current.orderStatusBreakdown),
    branches: branches(sources, context.scope), series: series(sources, context.window),
    storeInventoryByBranch: array(sources.inventory.storeInventoryByBranch), centralWarehouseInventory: object(sources.inventory.centralWarehouseInventory),
    topRentalProducts: array(sources.products.topRentalProducts), topSalesProducts: array(sources.products.topSalesProducts), slowMovingProducts: array(sources.products.slowMovingProducts),
    operationsByBranch: array(sources.operations.operationsByBranch),
    metricAvailability: { ...report.metricAvailability, ...object(sources.products.metricAvailability) } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003 */
async function readSources(context, queries) {
  const inventory = Promise.resolve(queries.inventory(context));
  const products = inventory.then((value) => queries.products({ ...context, inventory: value }));
  const names = ['orders', 'finance', 'inventory', 'operations', 'customers', 'products'];
  const values = await Promise.all([queries.orders(context), queries.finance(context), inventory, queries.operations(context), queries.customers(context), products]);
  return Object.fromEntries(names.map((name, index) => [name, object(values[index])]));
}

/**
 * Dependencies are server-internal; transport supplies only trusted user/query.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-001
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-002
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017
 */
export async function getOwnerPerformanceReport({ user, query = {} } = {}, { resolveScope = resolveOwnerReportScope, scopeDependencies, clock = () => new Date(), queries = {} } = {}) {
  try {
    requireOwner(user);
    const filters = validateOwnerPerformanceQuery(query), now = clock();
    const window = Object.freeze(resolveOwnerReportTimeWindow(filters, now));
    const scope = await resolveScope({ user }, scopeDependencies), context = Object.freeze({ scope, window });
    if (!array(scope.shops).length) return presentOwnerPerformanceReport({}, context);
    const sources = await readSources(context, { ...QUERIES, ...queries });
    return presentOwnerPerformanceReport(assemble(sources, context), context);
  } catch (failure) {
    const known = SAFE_ERRORS[failure?.code];
    if (known) throw error(known[0], failure.code, known[1]);
    throw sourceError();
  }
}
