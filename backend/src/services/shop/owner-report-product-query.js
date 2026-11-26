import mongoose from 'mongoose';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Product } from '../../models/masterdata/Product.js';
import { createReportMetric } from './owner-report-presenter.js';
const safe = (value) => Number.isSafeInteger(value) && value >= 0;
const id = (value) => /^[a-f0-9]{24}$/i.test(String(value)) ? String(value).toLowerCase() : null;
const failure = () => Object.assign(new Error('Nguồn sản phẩm không khả dụng.'), { statusCode: 500, code: 'ERR_OWNER_REPORT_SOURCE' });

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-014 */
function validNumber(field, minimum) {
  return { $cond: [{ $in: [{ $type: field }, ['double', 'int', 'long', 'decimal']] },
    { $and: [{ $gte: [field, minimum] }, { $lte: [field, Number.MAX_SAFE_INTEGER] }, { $eq: [{ $mod: [field, 1] }, 0] }] }, false] };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003 */
function variantLookup() {
  return { $lookup: { from: ProductVariant.collection.name, let: { variant: '$details.variantId' }, pipeline: [
    { $match: { $expr: { $eq: ['$_id', '$$variant'] } } }, { $project: { productId: 1 } },
    { $lookup: { from: Product.collection.name, let: { product: '$productId' }, pipeline: [
      { $match: { $expr: { $eq: ['$_id', '$$product'] } } }, { $project: { name: 1 } }], as: 'product' } },
    { $unwind: '$product' }, { $project: { _id: 0, productId: '$product._id', name: '$product.name' } },
  ], as: 'catalog' } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-014 */
export function ownerProductPipeline(scope, window, channel) {
  const rental = channel === 'rental', valid = { $and: [validNumber('$details.quantity', 1), validNumber('$details.lineTotal', 0)] };
  return [{ $match: { locationId: { $in: scope.locationIds.map((value) => new mongoose.Types.ObjectId(value)) },
    createdAt: { $gte: new Date(window.startAt), $lt: new Date(window.endAtExclusive) },
    [rental ? 'rentalStatus' : 'orderStatus']: { $in: rental ? ['confirmed', 'renting', 'partially_returned', 'returned', 'overdue'] : ['confirmed', 'processing', 'shipped', 'completed'] } } },
  { $project: { locationId: 1 } },
  { $lookup: { from: (rental ? RentalOrderDetail : SalesOrderDetail).collection.name, let: { order: '$_id' }, pipeline: [
    { $match: { $expr: { $eq: [rental ? '$rentalOrderId' : '$salesOrderId', '$$order'] } } }, { $project: { variantId: 1, quantity: 1, lineTotal: 1 } },
  ], as: 'details' } }, { $unwind: { path: '$details', preserveNullAndEmptyArrays: true } }, variantLookup(),
  { $project: { locationId: 1, productId: { $ifNull: [{ $arrayElemAt: ['$catalog.productId', 0] }, null] }, name: { $arrayElemAt: ['$catalog.name', 0] },
    quantity: { $cond: [valid, '$details.quantity', 0] }, value: { $cond: [valid, '$details.lineTotal', 0] }, known: { $cond: [valid, 1, 0] }, bad: { $cond: [valid, 0, 1] } } },
  { $group: { _id: { locationId: '$locationId', productId: '$productId', orderId: '$_id' }, name: { $first: '$name' },
    quantity: { $sum: '$quantity' }, value: { $sum: '$value' }, known: { $sum: '$known' }, bad: { $sum: '$bad' } } },
  { $group: { _id: { locationId: '$_id.locationId', productId: '$_id.productId' }, name: { $first: '$name' }, orderCount: { $sum: 1 },
    quantity: { $sum: '$quantity' }, value: { $sum: '$value' }, known: { $sum: '$known' }, bad: { $sum: '$bad' } } }];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-014 */
function collect(rows, scope) {
  if (!Array.isArray(rows)) throw failure();
  const products = new Map(); let mappingGap = false, amountGap = false;
  for (const row of rows) {
    if (!scope.locationById.has(String(row._id?.locationId))) continue;
    if (![row.orderCount, row.known, row.bad].every(safe)) throw failure();
    const productId = id(row._id?.productId);
    if (!productId) { mappingGap = true; continue; }
    if (!products.has(productId)) products.set(productId, { productId, name: typeof row.name === 'string' ? row.name : null, quantity: 0n, value: 0n, orderCount: 0n, known: 0n, bad: 0n });
    const product = products.get(productId); product.orderCount += BigInt(row.orderCount); product.bad += BigInt(row.bad);
    if (!safe(row.quantity) || !safe(row.value)) { product.bad++; amountGap = true; continue; }
    product.quantity += BigInt(row.quantity); product.value += BigInt(row.value); product.known += BigInt(row.known);
    if (row.bad) amountGap = true;
    if (product.name === null) mappingGap = true;
  }
  return { products, mappingGap, amountGap };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-014 */
function ranking(source) {
  const rows = []; let bad = source.mappingGap || source.amountGap;
  for (const product of source.products.values()) {
    const availability = product.bad || source.mappingGap ? product.known ? 'PARTIAL' : 'UNAVAILABLE' : 'AVAILABLE';
    const reasonCode = source.mappingGap ? 'EVENT_LINK_MISSING' : 'INVALID_AMOUNT';
    const values = Object.fromEntries(['quantity', 'value', 'orderCount'].map((key) => [key, createReportMetric(product[key], { availability, reasonCode }).value]));
    if (Object.values(values).some((value) => value === null)) { bad = true; continue; }
    rows.push({ productId: product.productId, name: product.name, quantity: values.quantity, orderValue: values.value, orderCount: values.orderCount,
      availability, ...(availability === 'AVAILABLE' ? {} : { reasonCode }) });
  }
  rows.sort((a, b) => a.orderValue === b.orderValue ? a.productId.localeCompare(b.productId) : a.orderValue > b.orderValue ? -1 : 1);
  const availability = bad ? rows.length ? 'PARTIAL' : 'UNAVAILABLE' : 'AVAILABLE';
  return { rows: rows.slice(0, 5), metadata: { availability, ...(bad ? { reasonCode: source.mappingGap ? 'EVENT_LINK_MISSING' : 'INVALID_AMOUNT' } : {}) } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-014 */
function slowMoving(inventory, sources) {
  if (!Array.isArray(inventory?.availableProducts) || sources.some((source) => source.mappingGap)) return { rows: [], metadata: { availability: 'UNAVAILABLE', reasonCode: 'EVENT_LINK_MISSING' } };
  const active = new Set(sources.flatMap((source) => [...source.products.keys()])), rows = new Map();
  let incomplete = inventory.centralWarehouseInventory?.availability !== 'AVAILABLE' || (inventory.storeInventoryByBranch || []).some((row) => row.availability !== 'AVAILABLE');
  for (const product of inventory.availableProducts) {
    const productId = id(product.productId);
    if (!productId || !safe(product.availableQuantity) || product.availability === 'UNAVAILABLE') { incomplete = true; continue; }
    if (product.availability !== 'AVAILABLE') incomplete = true;
    if (product.availableQuantity <= 0 || active.has(productId)) continue;
    if (rows.has(productId)) { incomplete = true; continue; }
    rows.set(productId, { productId, name: typeof product.name === 'string' ? product.name : null, availableQuantity: product.availableQuantity,
      availability: product.availability === 'PARTIAL' ? 'PARTIAL' : 'AVAILABLE', ...(product.availability === 'PARTIAL' ? { reasonCode: 'INVENTORY_SOURCE_CONFLICT' } : {}) });
  }
  const availability = incomplete ? rows.size ? 'PARTIAL' : 'UNAVAILABLE' : 'AVAILABLE';
  return { rows: [...rows.values()].sort((a, b) => a.productId.localeCompare(b.productId)), metadata: { availability, ...(incomplete ? { reasonCode: 'INVENTORY_SOURCE_CONFLICT' } : {}) } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-014 */
export function reduceOwnerProducts(results, inventory, scope) {
  const rental = collect(results.rental, scope), sales = collect(results.sales, scope);
  const topRental = ranking(rental), topSales = ranking(sales), slow = slowMoving(inventory, [rental, sales]);
  return { topRentalProducts: topRental.rows, topSalesProducts: topSales.rows, slowMovingProducts: slow.rows,
    metricAvailability: { topRentalProducts: topRental.metadata, topSalesProducts: topSales.metadata, slowMovingProducts: slow.metadata } };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003 */
export async function queryOwnerProducts({ scope, window, inventory }, { RentalModel = RentalOrder, SalesModel = SalesOrder } = {}) {
  if (!scope.locationIds.length) return reduceOwnerProducts({ rental: [], sales: [] }, inventory, scope);
  const [rental, sales] = await Promise.all([RentalModel.aggregate(ownerProductPipeline(scope, window, 'rental')), SalesModel.aggregate(ownerProductPipeline(scope, window, 'sales'))]);
  return reduceOwnerProducts({ rental, sales }, inventory, scope);
}
