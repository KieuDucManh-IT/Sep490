import { WalletTransaction } from '../../models/finance/WalletTransaction.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalDispute } from '../../models/sale&rental/RentalDispute.js';
import { buildOwnerReportBuckets } from './owner-report-time-window.js';
import { createReportMetric, sumIntegerVnd } from './owner-report-presenter.js';

const safe = (value) => Number.isSafeInteger(value) && value >= 0;
const failure = () => Object.assign(new Error('Nguồn báo cáo tiền không khả dụng.'), { statusCode: 500, code: 'ERR_OWNER_REPORT_SOURCE' });
const cell = () => ({ value: 0n, known: 0n, bad: 0n });
const summary = () => ({ rental: cell(), sales: cell(), refund: cell() });
const idsFor = (scope) => scope.locationIds.map((id) => new RentalOrder.base.Types.ObjectId(id));
const validAmount = (field, minimum = 0) => ({ $cond: [{ $in: [{ $type: field }, ['double', 'int', 'long', 'decimal']] },
  { $and: [{ $gte: [field, minimum] }, { $lte: [field, Number.MAX_SAFE_INTEGER] }, { $eq: [{ $mod: [field, 1] }, 0] }] }, false] });

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003 */
function parentLookup(from, ref, ids, as) {
  return { $lookup: { from, let: { ref }, pipeline: [
    { $match: { locationId: { $in: ids }, $expr: { $eq: ['$_id', '$$ref'] } } }, { $project: { locationId: 1 } },
  ], as } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-009 */
function disputeLookup(ids) {
  return { $lookup: { from: RentalDispute.collection.name, let: { ref: '$referenceId' }, pipeline: [
    { $match: { $expr: { $eq: ['$_id', '$$ref'] } } }, { $project: { rentalOrderId: 1 } },
    parentLookup(RentalOrder.collection.name, '$rentalOrderId', ids, 'parent'), { $unwind: '$parent' },
    { $project: { locationId: '$parent.locationId' } },
  ], as: 'dispute' } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-008 */
export function ownerFinancePipeline(scope, window) {
  const ids = idsFor(scope), buckets = buildOwnerReportBuckets(window);
  const cases = [...buckets, ...buildOwnerReportBuckets(window, { comparison: true })].map((bucket, index) => ({
    case: { $and: [{ $gte: ['$completedAt', new Date(bucket.startAt)] }, { $lt: ['$completedAt', new Date(bucket.endAtExclusive)] }] }, then: index < buckets.length ? index : index - buckets.length,
  }));
  const refund = { $and: [{ $eq: ['$direction', 'credit'] }, { $or: [{ $eq: ['$transactionType', 'refund'] },
    { $and: [{ $eq: ['$transactionType', 'deposit_refund'] }, { $eq: ['$referenceType', 'RentalOrder'] }] }] }] };
  return [{ $match: { status: 'success', transactionType: { $in: ['rental_payment', 'payment', 'refund', 'deposit_refund'] }, completedAt: { $gte: new Date(window.comparisonStartAt), $lt: new Date(window.endAtExclusive) } } },
    parentLookup(RentalOrder.collection.name, '$referenceId', ids, 'rental'), parentLookup(SalesOrder.collection.name, '$referenceId', ids, 'sales'), disputeLookup(ids),
    { $project: { completedAt: 1, amount: 1, direction: 1, transactionType: 1, referenceType: 1,
      channel: { $cond: [{ $eq: ['$referenceType', 'SalesOrder'] }, 'sales', { $cond: [{ $in: ['$referenceType', ['RentalOrder', 'RentalDispute']] }, 'rental', null] }] },
      locationId: { $switch: { branches: ['RentalOrder', 'SalesOrder', 'RentalDispute'].map((type, index) => ({ case: { $eq: ['$referenceType', type] }, then: { $arrayElemAt: [`$${['rental', 'sales', 'dispute'][index]}.locationId`, 0] } })), default: null } } } },
    { $match: { locationId: { $in: ids } } },
    { $project: { locationId: 1, channel: 1, value: { $cond: [validAmount('$amount', 1), '$amount', 0] }, bad: { $cond: [validAmount('$amount', 1), 0, 1] },
      kind: { $switch: { branches: [{ case: refund, then: 'refund' }, { case: { $and: [{ $eq: ['$direction', 'debit'] }, { $or: [
        { $and: [{ $eq: ['$referenceType', 'RentalOrder'] }, { $eq: ['$transactionType', 'rental_payment'] }] }, { $and: [{ $eq: ['$referenceType', 'SalesOrder'] }, { $eq: ['$transactionType', 'payment'] }] },
      ] }] }, then: 'collection' }], default: null } },
      period: { $cond: [{ $gte: ['$completedAt', new Date(window.startAt)] }, 'current', 'comparison'] }, bucket: { $switch: { branches: cases, default: -1 } } } },
    { $match: { kind: { $in: ['collection', 'refund'] } } },
    { $group: { _id: { locationId: '$locationId', channel: '$channel', kind: '$kind', period: '$period', bucket: '$bucket' }, count: { $sum: 1 }, value: { $sum: '$value' }, bad: { $sum: '$bad' } } }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-011 */
export function ownerDepositPipeline(scope) {
  return [{ $match: { locationId: { $in: idsFor(scope) } } }, { $facet: {
    rows: [{ $match: { depositStatus: 'held' } }, { $group: { _id: '$locationId', count: { $sum: 1 },
      value: { $sum: { $cond: [validAmount('$depositAmount'), '$depositAmount', 0] } }, bad: { $sum: { $cond: [validAmount('$depositAmount'), 0, 1] } } } }],
    gaps: [{ $match: { depositStatus: { $nin: ['pending', 'held', 'partially_refunded', 'refunded', 'forfeited', 'partially_deducted'] } } }, { $group: { _id: '$locationId', count: { $sum: 1 } } }],
  } }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function add(target, row) {
  if (!safe(row.count) || !safe(row.bad) || row.bad > row.count) throw failure();
  if (!safe(row.value)) { target.bad += BigInt(row.count); return; }
  target.value += BigInt(row.value); target.known += BigInt(row.count - row.bad); target.bad += BigInt(row.bad);
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function financialMetric(target) {
  // Writer coverage is incomplete for COD/legacy wallet/refund paths even when no gap row is found in this period.
  return createReportMetric(target.value, { availability: target.known ? 'PARTIAL' : 'UNAVAILABLE', reasonCode: target.bad ? 'INVALID_AMOUNT' : 'SOURCE_COVERAGE_INCOMPLETE' });
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function moneySummary(target) {
  const rental = financialMetric(target.rental), sales = financialMetric(target.sales), refund = financialMetric(target.refund);
  const known = [rental.value, sales.value].filter((value) => value !== null);
  const total = createReportMetric(known.length ? sumIntegerVnd(known).value : null, { availability: known.length ? 'PARTIAL' : 'UNAVAILABLE', reasonCode: 'SOURCE_COVERAGE_INCOMPLETE' });
  return { metrics: { successfulCollections: { rental: rental.value, sales: sales.value, total: total.value, availability: total.availability, reasonCode: total.reasonCode },
    completedRefundOutflows: { total: refund.value, availability: refund.availability, reasonCode: refund.reasonCode } },
    metricAvailability: { successfulCollections: { availability: total.availability, reasonCode: total.reasonCode }, completedRefundOutflows: { availability: refund.availability, reasonCode: refund.reasonCode } } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-009 */
export function reduceOwnerFinance(rows, deposits, scope, window) {
  if (!Array.isArray(rows) || !deposits || !Array.isArray(deposits.rows) || !Array.isArray(deposits.gaps)) throw failure();
  const periods = { current: summary(), comparison: summary() }, byShop = new Map(scope.shops.map((shop) => [shop.shopId, { current: summary(), comparison: summary(), deposit: cell() }]));
  const buckets = buildOwnerReportBuckets(window), series = buckets.map(summary), deposit = cell();
  for (const row of rows) {
    const location = scope.locationById.get(String(row._id?.locationId));
    if (!location || !byShop.has(location.shopId)) continue;
    if (!['current', 'comparison'].includes(row._id.period) || !['rental', 'sales'].includes(row._id.channel) || !['collection', 'refund'].includes(row._id.kind)) throw failure();
    const key = row._id.kind === 'refund' ? 'refund' : row._id.channel;
    const targets = [periods[row._id.period], byShop.get(location.shopId)[row._id.period]];
    if (row._id.period === 'current') { if (!Number.isInteger(row._id.bucket) || row._id.bucket < 0 || row._id.bucket >= series.length) throw failure(); targets.push(series[row._id.bucket]); }
    for (const target of targets) add(target[key], row);
  }
  for (const row of deposits.rows) {
    const location = scope.locationById.get(String(row._id));
    if (location && byShop.has(location.shopId)) { add(deposit, row); add(byShop.get(location.shopId).deposit, row); }
  }
  for (const row of deposits.gaps) {
    const location = scope.locationById.get(String(row._id));
    if (!location || !byShop.has(location.shopId)) continue;
    if (!safe(row.count)) throw failure(); deposit.bad += BigInt(row.count); byShop.get(location.shopId).deposit.bad += BigInt(row.count);
  }
  const depositMetric = (target) => createReportMetric(target.value, { availability: target.bad ? target.known ? 'PARTIAL' : 'UNAVAILABLE' : 'AVAILABLE', reasonCode: 'SOURCE_COVERAGE_INCOMPLETE' });
  return { current: moneySummary(periods.current), comparison: moneySummary(periods.comparison), heldDepositsSnapshot: depositMetric(deposit),
    branches: [...byShop].map(([shopId, target]) => ({ shopId, current: moneySummary(target.current), comparison: moneySummary(target.comparison), heldDepositsSnapshot: depositMetric(target.deposit) })),
    series: series.map((target, index) => { const result = moneySummary(target); return { ...buckets[index], ...result.metrics, metricAvailability: result.metricAvailability }; }) };
}

/**
 * Only timestamped, typed-parent events enter aggregates. No balance decryption,
 * COD/order-value reconstruction, or fallback to a missing event reference/time.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-008
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-009
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-011
 */
export async function queryOwnerFinance({ scope, window }, { WalletModel = WalletTransaction, RentalModel = RentalOrder } = {}) {
  if (!scope.locationIds.length) return reduceOwnerFinance([], { rows: [], gaps: [] }, scope, window);
  const [rows, deposits] = await Promise.all([WalletModel.aggregate(ownerFinancePipeline(scope, window)), RentalModel.aggregate(ownerDepositPipeline(scope))]);
  return reduceOwnerFinance(rows, deposits[0], scope, window);
}
