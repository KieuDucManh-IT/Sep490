import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { createReportMetric } from './owner-report-presenter.js';

const FIELDS = ['quantityOnHand', 'quantityReserved', 'quantityUnavailable', 'quantityRenting'];
const COUNTERS = ['available', 'reserved', 'renting', 'unavailable', 'maintenance', 'inTransit'];
const safe = (value) => Number.isSafeInteger(value) && value >= 0;
const failure = () => Object.assign(new Error('Nguồn snapshot tồn không khả dụng.'), { statusCode: 500, code: 'ERR_OWNER_REPORT_SOURCE' });
const key = (location, variant) => `${location}:${variant}`;
const bucket = () => ({ values: Object.fromEntries(COUNTERS.map((field) => [field, 0n])), missing: new Set(), known: 0, bad: 0 });

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-013 */
export function ownerInventoryPipeline(scope, kind) {
  const ids = scope.locationIds.map((id) => new ProductVariant.base.Types.ObjectId(id));
  if (kind === 'items') {
    const validCode = { $cond: [{ $eq: [{ $type: '$_id' }, 'string'] }, { $gt: [{ $strLenCP: '$_id' }, 0] }, false] };
    const valid = { $and: [{ $eq: ['$documents', 1] }, validCode] };
    return [{ $match: { locationId: { $in: ids } } },
      { $group: { _id: '$itemCode', locations: { $addToSet: '$locationId' }, variants: { $addToSet: '$variantId' }, status: { $first: '$status' }, documents: { $sum: 1 } } },
      { $unwind: '$locations' }, { $unwind: '$variants' },
      { $group: { _id: { locationId: '$locations', variantId: '$variants', status: '$status' }, count: { $sum: { $cond: [valid, 1, 0] } }, invalid: { $sum: { $cond: [valid, 0, 1] } } } }];
  }
  const typed = { $and: FIELDS.map((field) => ({ $in: [{ $type: `$${field}` }, ['int', 'long', 'double', 'decimal']] })) };
  const valid = { $cond: [typed, { $and: [...FIELDS.map((field) => ({ $and: [{ $gte: [`$${field}`, 0] }, { $lte: [`$${field}`, Number.MAX_SAFE_INTEGER] }, { $eq: [{ $mod: [`$${field}`, 1] }, 0] }] })),
    { $lte: [{ $add: ['$quantityReserved', '$quantityUnavailable'] }, '$quantityOnHand'] }] }, false] };
  return [{ $match: { locationId: { $in: ids } } },
    { $group: { _id: { locationId: '$locationId', variantId: '$variantId', storageId: '$storageId' }, documents: { $sum: 1 }, invalid: { $sum: { $cond: [valid, 0, 1] } },
      ...Object.fromEntries(FIELDS.map((field) => [field, { $sum: { $cond: [valid, `$${field}`, 0] } }])) } },
    { $group: { _id: { locationId: '$_id.locationId', variantId: '$_id.variantId' },
      known: { $sum: { $cond: [{ $and: [{ $eq: ['$documents', 1] }, { $eq: ['$invalid', 0] }] }, 1, 0] } },
      invalid: { $sum: { $cond: [{ $gt: ['$documents', 1] }, '$documents', '$invalid'] } },
      ...Object.fromEntries(FIELDS.map((field) => [field, { $sum: { $cond: [{ $and: [{ $eq: ['$documents', 1] }, { $eq: ['$invalid', 0] }] }, `$${field}`, 0] } }])) } }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-013 */
function itemCounts(rows) {
  const counts = Object.fromEntries(['available', 'reserved', 'renting', 'maintenance', 'unavailable', 'in_transit'].map((field) => [field, 0]));
  let bad = false;
  for (const row of rows) {
    if (!safe(row.count) || !safe(row.invalid)) throw failure();
    if (row.invalid) bad = true;
    if (Object.hasOwn(counts, row._id.status)) counts[row._id.status] += row.count;
    else if (!['sold', 'disposed'].includes(row._id.status)) bad = true;
  }
  return { counts, bad };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-013 */
function partition(balance, rows, trackingType) {
  const items = itemCounts(rows), physical = Object.values(items.counts).reduce((sum, value) => sum + value, 0);
  const validBalance = balance && FIELDS.every((field) => safe(balance[field])) && safe(balance.invalid) && safe(balance.known)
    && balance.quantityReserved + balance.quantityUnavailable <= balance.quantityOnHand;
  if (trackingType === 'quantity') {
    if (!validBalance) return { values: {}, known: false, bad: true };
    return { values: { available: balance.quantityOnHand - balance.quantityReserved - balance.quantityUnavailable, reserved: balance.quantityReserved, renting: balance.quantityRenting, unavailable: balance.quantityUnavailable },
      known: balance.known > 0, bad: balance.invalid > 0 || rows.length > 0 };
  }
  if (trackingType !== 'individual') return { values: {}, known: false, bad: true };
  const c = items.counts, unavailable = c.maintenance + c.unavailable;
  const consistent = validBalance && balance.invalid === 0 && balance.quantityOnHand === c.available + c.reserved + unavailable
    && balance.quantityReserved === c.reserved && balance.quantityUnavailable === unavailable && balance.quantityRenting === c.renting;
  return { values: { available: c.available, reserved: c.reserved, renting: c.renting, unavailable, maintenance: c.maintenance, inTransit: c.in_transit },
    known: physical > 0 || (consistent && !items.bad), bad: !consistent || items.bad };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-013 */
function add(target, part) {
  target.bad += part.bad ? 1 : 0; target.known += part.known ? 1 : 0;
  for (const field of COUNTERS) {
    if (!Object.hasOwn(part.values, field)) { target.missing.add(field); continue; }
    if (!safe(part.values[field])) { target.bad++; target.missing.add(field); continue; }
    target.values[field] += BigInt(part.values[field]);
  }
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
function presentBucket(target) {
  const availability = target.bad ? target.known ? 'PARTIAL' : 'UNAVAILABLE' : 'AVAILABLE';
  const result = { availability, ...(availability === 'AVAILABLE' ? {} : { reasonCode: 'INVENTORY_SOURCE_CONFLICT' }) };
  for (const field of COUNTERS) {
    if (target.missing.has(field)) { result[field] = null; continue; }
    const metric = createReportMetric(target.values[field], { availability, reasonCode: 'INVENTORY_SOURCE_CONFLICT' });
    result[field] = metric.value;
    if (metric.availability === 'UNAVAILABLE' && availability !== 'UNAVAILABLE') Object.assign(result, { availability: 'PARTIAL', reasonCode: 'INVALID_AMOUNT' });
  }
  return result;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-013 */
export function reduceOwnerInventory(balances, items, variants, scope) {
  if (![balances, items, variants].every(Array.isArray)) throw failure();
  const grouped = new Map(), catalog = new Map(variants.map((variant) => [String(variant._id), variant.productId]));
  const ensure = (locationId, variantId) => { const token = key(locationId, variantId); if (!grouped.has(token)) grouped.set(token, { locationId, variantId, rows: [] }); return grouped.get(token); };
  for (const balance of balances) if (scope.locationById.has(String(balance._id?.locationId))) ensure(String(balance._id.locationId), String(balance._id.variantId)).balance = balance;
  for (const item of items) if (scope.locationById.has(String(item._id?.locationId))) ensure(String(item._id.locationId), String(item._id.variantId)).rows.push(item);
  const stores = new Map(scope.shops.map((shop) => [shop.shopId, bucket()])), warehouse = bucket(), products = new Map();
  for (const group of grouped.values()) {
    const location = scope.locationById.get(group.locationId), product = catalog.get(group.variantId);
    const part = partition(group.balance, group.rows, product?.trackingType);
    const target = location.type === 'warehouse' ? warehouse : stores.get(location.shopId);
    if (!target) continue;
    add(target, part);
    if (!product?._id) continue;
    const productId = String(product._id);
    if (!products.has(productId)) products.set(productId, { productId, name: typeof product.name === 'string' ? product.name : null, ...bucket() });
    add(products.get(productId), part);
  }
  return { storeInventoryByBranch: [...stores].map(([shopId, target]) => ({ shopId, ...presentBucket(target) })), centralWarehouseInventory: presentBucket(warehouse),
    availableProducts: [...products.values()].map((target) => { const snapshot = presentBucket(target); return { productId: target.productId, name: target.name, availableQuantity: snapshot.available, availability: snapshot.availability, reasonCode: snapshot.reasonCode }; }) };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003 */
export async function queryOwnerInventory({ scope }, { BalanceModel = InventoryBalance, ItemModel = InventoryItem, VariantModel = ProductVariant } = {}) {
  if (!scope.locationIds.length) return reduceOwnerInventory([], [], [], scope);
  const [balances, items] = await Promise.all([BalanceModel.aggregate(ownerInventoryPipeline(scope, 'balances')), ItemModel.aggregate(ownerInventoryPipeline(scope, 'items'))]);
  const ids = [...new Set([...balances, ...items].filter((row) => scope.locationById.has(String(row._id?.locationId))).map((row) => String(row._id.variantId)).filter((id) => /^[a-f0-9]{24}$/i.test(id)))];
  const variants = ids.length ? await VariantModel.find({ _id: { $in: ids } }).select('_id productId').populate({ path: 'productId', select: '_id name trackingType' }).lean() : [];
  return reduceOwnerInventory(balances, items, variants, scope);
}
