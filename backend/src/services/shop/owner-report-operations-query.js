import mongoose from 'mongoose';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalReturn } from '../../models/sale&rental/RentalReturn.js';
import { RentalDispute } from '../../models/sale&rental/RentalDispute.js';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
const COUNTERS = ['overdue', 'upcomingReturns', 'inspection', 'openDisputes', 'pendingHandover', 'incomingTransfers', 'failedShipments'];
const failure = () => Object.assign(new Error('Nguồn vận hành không khả dụng.'), { statusCode: 500, code: 'ERR_OWNER_REPORT_SOURCE' });
const count = (field, condition) => ({ $group: { _id: `$${field}`, count: { $sum: condition ? { $cond: [condition, 1, 0] } : 1 } } });

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-015 */
function parentJoin(collection, reference, ids, type) {
  return [{ $lookup: { from: collection, let: { parentId: `$${reference}`, kind: '$orderType' }, pipeline: [
    { $match: { locationId: { $in: ids }, $expr: { $and: [{ $eq: ['$_id', '$$parentId'] }, ...(type ? [{ $eq: ['$$kind', type] }] : [])] } } },
    { $project: { _id: 0, locationId: 1 } }], as: 'parent' } }, { $unwind: '$parent' }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-015 */
export function ownerOperationsPipeline(scope, window, source) {
  const ids = scope.locationIds.map((id) => new mongoose.Types.ObjectId(id));
  const now = new Date(window.generatedAt), limit = new Date(now.getTime() + 48 * 3600000);
  if (source === 'rental') {
    const active = { $in: ['$rentalStatus', ['renting', 'partially_returned']] };
    const dated = { $eq: [{ $type: '$dueDate' }, 'date'] };
    return [{ $match: { locationId: { $in: ids }, rentalStatus: { $in: ['confirmed', 'renting', 'partially_returned', 'overdue'] } } },
      { $facet: {
        overdue: [count('locationId', { $or: [{ $eq: ['$rentalStatus', 'overdue'] }, { $and: [active, dated, { $lt: ['$dueDate', now] }] }] })],
        upcomingReturns: [count('locationId', { $and: [active, dated, { $gte: ['$dueDate', now] }, { $lte: ['$dueDate', limit] }] })],
        pendingHandover: [count('locationId', { $eq: ['$rentalStatus', 'confirmed'] })],
        gaps: [{ $match: { $expr: { $and: [active, { $not: [dated] }] } } }, count('locationId')],
      } }];
  }
  if (source === 'sales') return [{ $match: { locationId: { $in: ids }, orderStatus: { $in: ['confirmed', 'processing'] } } }, count('locationId')];
  if (source === 'transfers') return [{ $match: { toLocationId: { $in: ids }, status: { $in: ['shipped', 'partially_received'] } } }, count('toLocationId')];
  if (source === 'shipments') return [{ $match: { shipmentStatus: 'failed', orderType: { $in: ['rental', 'sale'] } } },
    ...parentJoin(RentalOrder.collection.name, 'orderId', ids, 'rental'), count('parent.locationId')];
  if (source === 'salesShipments') return [{ $match: { shipmentStatus: 'failed', orderType: 'sale' } },
    ...parentJoin(SalesOrder.collection.name, 'orderId', ids, 'sale'), count('parent.locationId')];
  const filter = source === 'returns' ? { returnStatus: { $in: ['received', 'inspecting'] } } : { status: { $in: ['pending_review', 'approved'] } };
  return [{ $match: filter }, ...parentJoin(RentalOrder.collection.name, 'rentalOrderId', ids), count('parent.locationId')];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-015 */
export function reduceOwnerOperations(results, scope) {
  const rows = new Map(scope.shops.map(({ shopId }) => [shopId, { shopId, ...Object.fromEntries(COUNTERS.map((name) => [name, 0])), availability: 'AVAILABLE' }]));
  const missing = (names) => { for (const row of rows.values()) for (const name of names) { row[name] = null; row.availability = 'PARTIAL'; row.reasonCode = 'SOURCE_COVERAGE_INCOMPLETE'; } };
  const add = (values, name) => {
    if (values === null) { missing([name]); return; }
    if (!Array.isArray(values)) throw failure();
    for (const value of values) {
      const shopId = scope.locationById.get(String(value._id))?.shopId, row = rows.get(shopId);
      if (!row) continue;
      if (!Number.isSafeInteger(value.count) || value.count < 0 || !Number.isSafeInteger((row[name] || 0) + value.count)) throw failure();
      if (row[name] !== null) row[name] += value.count;
    }
  };
  if (results.rental === null) missing(['overdue', 'upcomingReturns', 'pendingHandover']);
  else {
    for (const name of ['overdue', 'upcomingReturns', 'pendingHandover']) add(results.rental?.[name], name);
    for (const gap of results.rental?.gaps || []) {
      const row = rows.get(scope.locationById.get(String(gap._id))?.shopId);
      if (row) Object.assign(row, { availability: 'PARTIAL', reasonCode: 'EVENT_TIME_MISSING' });
    }
  }
  for (const [source, name] of Object.entries({ sales: 'pendingHandover', returns: 'inspection', disputes: 'openDisputes', transfers: 'incomingTransfers', shipments: 'failedShipments', salesShipments: 'failedShipments' })) add(results[source], name);
  for (const row of rows.values()) if (COUNTERS.every((name) => row[name] === null)) row.availability = 'UNAVAILABLE';
  return { operationsByBranch: [...rows.values()] };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003 */
export async function queryOwnerOperations({ scope, window }, dependencies = {}) {
  const defaults = { rental: RentalOrder, sales: SalesOrder, returns: RentalReturn, disputes: RentalDispute, transfers: StockTransfer, shipments: OrderShipment, salesShipments: OrderShipment };
  const results = {};
  for (const [source, defaultModel] of Object.entries(defaults)) {
    const model = Object.hasOwn(dependencies, source) ? dependencies[source] : defaultModel;
    const data = !scope.locationIds.length ? [] : model ? await model.aggregate(ownerOperationsPipeline(scope, window, source)) : null;
    results[source] = source === 'rental' && data !== null ? data[0] || { overdue: [], upcomingReturns: [], pendingHandover: [], gaps: [] } : data;
  }
  return reduceOwnerOperations(results, scope);
}
