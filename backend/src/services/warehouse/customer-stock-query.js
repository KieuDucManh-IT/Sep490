import mongoose from 'mongoose';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryReservation } from '../../models/warehouse/inventory/InventoryReservation.js';
import { getBalances } from './balanceQueryService.js';

const idOf = value => String(value?._id || value || '');
const keyOf = row => `${idOf(row.variantId)}:${idOf(row.locationId)}`;
const uniqueIds = values => [...new Map(values.map(value => [idOf(value), value])).values()];

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-021
 * One grouped read, restricted to pairs with no Balance; aggregates do not cast IDs automatically. */
const groupedQuantities = async (model, pairs, filters, quantity, session) => {
  const query = model.aggregate([
    { $match: { $or: pairs, ...filters } },
    { $group: { _id: { variantId: '$variantId', locationId: '$locationId' }, quantity: { $sum: quantity } } },
  ]);
  if (session) query.session(session);
  return query.exec();
};

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-021
 * Read-only Balance-shaped snapshots, not persisted balances or authorization to reserve stock. */
const fallbackRows = async (missing, session) => {
  const pairs = missing.map(row => ({
    variantId: new mongoose.Types.ObjectId(idOf(row.variantId)),
    locationId: new mongoose.Types.ObjectId(idOf(row.locationId)),
  }));
  const [items, reservations] = await Promise.all([
    groupedQuantities(InventoryItem, pairs,
      { status: 'available', condition: { $nin: ['damaged', 'unrepairable', 'missing'] } }, 1, session),
    groupedQuantities(InventoryReservation, pairs, { status: 'active' }, '$quantity', session),
  ]);
  const counts = new Map(items.map(row => [keyOf(row._id), row.quantity]));
  const reserved = new Map(reservations.map(row => [keyOf(row._id), row.quantity]));
  return missing.filter(row => counts.get(keyOf(row)) > 0).map(row => ({
    ...row, quantityOnHand: counts.get(keyOf(row)),
    quantityReserved: reserved.get(keyOf(row)) || 0, quantityUnavailable: 0,
  }));
};

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-021
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-025
 * Callers resolve active store/variant scope first. Balance existence, including zero, wins per pair.
 * Keep the supplied transaction session on all reads; final atomic reservation remains Balance-only. */
export const getCustomerStock = async ({ locationIds = [], variantIds = [] } = {}, session = null) => {
  if (!locationIds.length || !variantIds.length) return [];
  const locations = uniqueIds(locationIds), variants = uniqueIds(variantIds);
  const locationKeys = new Set(locations.map(idOf)), variantKeys = new Set(variants.map(idOf));
  const balances = (await getBalances({ locationIds: locations, variantIds: variants }, session))
    .filter(row => locationKeys.has(idOf(row.locationId)) && variantKeys.has(idOf(row.variantId)));
  const known = new Set(balances.map(keyOf));
  const missing = variants.flatMap(variantId => locations.map(locationId => ({ variantId, locationId })))
    .filter(row => !known.has(keyOf(row)));
  return missing.length ? [...balances, ...await fallbackRows(missing, session)] : balances;
};
