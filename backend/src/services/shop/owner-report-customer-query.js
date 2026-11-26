import mongoose from 'mongoose';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { calculateReturningRate } from './owner-report-presenter.js';
const failure = () => Object.assign(new Error('Nguồn khách hàng không khả dụng.'), { statusCode: 500, code: 'ERR_OWNER_REPORT_SOURCE' });

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-016 */
function completedSource(ids, channel) {
  const rental = channel === 'rental';
  return [{ $match: { locationId: { $in: ids }, [rental ? 'rentalStatus' : 'orderStatus']: rental ? 'returned' : 'completed' } },
    { $project: { _id: 0, customerId: 1, locationId: 1, completedAt: rental ? '$actualReturnedAt' : '$completedAt' } }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-016 */
function cohortFacet(start, period, common) {
  return [...common, { $match: { [period]: 1 } }, { $group: { _id: null, unique: { $sum: 1 },
    returning: { $sum: { $cond: [{ $lt: ['$firstAt', new Date(start)] }, 1, 0] } } } }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-016 */
export function ownerCustomerPipeline(scope, window) {
  const ids = scope.locationIds.map((id) => new mongoose.Types.ObjectId(id));
  const valid = { $and: [{ $eq: [{ $type: '$customerId' }, 'objectId'] }, { $eq: [{ $type: '$completedAt' }, 'date'] }] };
  const inPeriod = (start, end) => ({ $and: [{ $gte: ['$completedAt', new Date(start)] }, { $lt: ['$completedAt', new Date(end)] }] });
  const current = inPeriod(window.startAt, window.endAtExclusive), comparison = inPeriod(window.comparisonStartAt, window.comparisonEndAtExclusive);
  const common = [{ $match: { $expr: valid } }, { $group: { _id: '$customerId', firstAt: { $min: '$completedAt' },
    current: { $max: { $cond: [current, 1, 0] } }, comparison: { $max: { $cond: [comparison, 1, 0] } } } }];
  return [...completedSource(ids, 'rental'), { $unionWith: { coll: SalesOrder.collection.name, pipeline: completedSource(ids, 'sales') } },
    { $facet: {
      gaps: [{ $match: { $expr: { $not: [valid] } } }, { $group: { _id: '$locationId', count: { $sum: 1 } } }],
      current: cohortFacet(window.startAt, 'current', common),
      comparison: cohortFacet(window.comparisonStartAt, 'comparison', common),
    } }, { $project: { _id: 0, gaps: 1, cohorts: [{ current: '$current', comparison: '$comparison', currentLocations: [], comparisonLocations: [] }] } }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-016 */
function metric(row, partial) {
  const unique = row?.unique ?? 0, returning = row?.returning ?? 0;
  if (![unique, returning].every((value) => Number.isSafeInteger(value) && value >= 0) || returning > unique) throw failure();
  return { unique, new: unique - returning, returning, returningRate: calculateReturningRate(returning, unique), availability: partial ? 'PARTIAL' : 'AVAILABLE',
    ...(partial ? { reasonCode: 'SOURCE_COVERAGE_INCOMPLETE' } : {}) };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-016 */
export function reduceOwnerCustomers(result, scope) {
  if (!result || !Array.isArray(result.gaps) || !Array.isArray(result.cohorts)) throw failure();
  const partial = result.gaps.some((row) => scope.locationById.has(String(row._id)) && row.count > 0);
  const cohorts = result.cohorts[0] || { current: [], comparison: [], currentLocations: [], comparisonLocations: [] };
  if (!['current', 'comparison', 'currentLocations', 'comparisonLocations'].every((name) => Array.isArray(cohorts[name]))) throw failure();
  return { current: { metrics: { customers: metric(cohorts.current[0], partial) } }, comparison: { metrics: { customers: metric(cohorts.comparison[0], partial) } } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003 */
export async function queryOwnerCustomers({ scope, window }, { RentalModel = RentalOrder } = {}) {
  if (!scope.locationIds.length) return reduceOwnerCustomers({ gaps: [], cohorts: [] }, scope);
  const result = await RentalModel.aggregate(ownerCustomerPipeline(scope, window));
  if (!Array.isArray(result) || result.length !== 1) throw failure();
  return reduceOwnerCustomers(result[0], scope);
}
