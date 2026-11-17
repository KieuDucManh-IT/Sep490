import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { InventoryReservation } from '../../models/warehouse/inventory/InventoryReservation.js';

export const formatLocationAddress = (loc) => {
  if (!loc) return '';
  if (loc.address && loc.address.trim()) {
    return loc.address.trim();
  }
  const shop = loc.shopId;
  if (shop && typeof shop === 'object') {
    const shopParts = [shop.address, shop.ward, shop.city].filter(Boolean);
    if (shopParts.length > 0) return shopParts.join(', ');
    if (shop.name) return shop.name;
  }
  return loc.name || '';
};


const idOf = (value) => String(value?._id || value || '');
const nonnegative = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export const isWarehouseLocation = (loc) => {
  const name = String(loc?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return String(loc?.type).toLowerCase() === 'warehouse' || /kho tong|kho trung tam/.test(name);
};
export const isActiveStoreLocation = (loc) => Boolean(loc && loc.status === 'active' && !loc.isDeleted &&
  !isWarehouseLocation(loc) && (!loc.shopId || !loc.shopId._id ||
    (!loc.shopId.isDeleted && (!loc.shopId.status || String(loc.shopId.status).toLowerCase() === 'active'))));
export const validateActiveStoreLocation = async (locationId) => {
  const location = locationId ? await InventoryLocation.findById(locationId).lean() : null;
  return isActiveStoreLocation(location)
    ? { valid: true, location, code: null }
    : { valid: false, location, code: 'ERR_BRANCH_UNAVAILABLE', message: 'Chi nhánh không tồn tại, ngừng hoạt động hoặc là kho tổng.' };
};

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-025 */
export const enrichProductsWithInventory = async (products = [], variants = []) => {
  if (!products.length) return [];
  const variantIds = variants.map(v => v._id);
  const [balances, items] = variantIds.length ? await Promise.all([
    InventoryBalance.find({ variantId: { $in: variantIds } }).populate({ path: 'locationId', populate: { path: 'shopId' } }).lean(),
    InventoryItem.find({ variantId: { $in: variantIds }, status: { $nin: ['disposed', 'in_transit'] } })
      .populate({ path: 'locationId', populate: { path: 'shopId' } }).lean(),
  ]) : [[], []];
  const byPair = new Map();
  const rowFor = (row) => {
    const location = row.locationId;
    if (!isActiveStoreLocation(location)) return null;
    const key = idOf(row.variantId) + ':' + idOf(location);
    if (!byPair.has(key)) byPair.set(key, { variantId: idOf(row.variantId), location, balances: [], items: [] });
    return byPair.get(key);
  };
  for (const row of balances) rowFor(row)?.balances.push(row);
  for (const row of items) rowFor(row)?.items.push(row);
  // Only fallback pairs need reservations; a balance already includes quantityReserved.
  const fallback = [...byPair.values()].filter(row => !row.balances.length);
  const reservations = fallback.length ? await InventoryReservation.find({
    variantId: { $in: fallback.map(row => row.variantId) }, status: 'active',
  }).select('variantId locationId quantity').lean() : [];
  for (const row of byPair.values()) {
    row.quantityOnHand = row.balances.length
      ? row.balances.reduce((sum, b) => sum + nonnegative(b.quantityOnHand), 0) : row.items.length;
    row.quantityAvailable = row.balances.length
      ? row.balances.reduce((sum, b) => sum + Math.max(0, nonnegative(b.quantityOnHand) - nonnegative(b.quantityReserved) - nonnegative(b.quantityUnavailable)), 0)
      : Math.max(0, row.items.filter(it => it.status === 'available' && !['damaged', 'unrepairable', 'missing'].includes(it.condition)).length -
        reservations.filter(r => idOf(r.variantId) === row.variantId && idOf(r.locationId) === idOf(row.location)).reduce((sum, r) => sum + nonnegative(r.quantity), 0));
  }
  return products.map(product => {
    const pVariants = variants.filter(v => idOf(v.productId) === idOf(product));
    const ids = new Set(pVariants.map(v => idOf(v)));
    const locations = new Map();
    for (const row of byPair.values()) {
      if (!ids.has(row.variantId)) continue;
      const loc = row.location; const lid = idOf(loc);
      if (!locations.has(lid)) locations.set(lid, {
        locationId: lid, shopId: loc.shopId?._id || loc.shopId || null, name: loc.name,
        type: loc.type, status: loc.status, address: formatLocationAddress(loc),
        city: loc.shopId?.city || loc.city || '', latitude: loc.shopId?.latitude ?? loc.latitude ?? null,
        longitude: loc.shopId?.longitude ?? loc.longitude ?? null,
        quantityOnHand: 0, quantityAvailable: 0, quantity: 0, variantQuantities: {},
      });
      const branch = locations.get(lid);
      branch.quantityOnHand += row.quantityOnHand;
      branch.quantityAvailable += row.quantityAvailable;
      branch.quantity += row.quantityAvailable;
      branch.variantQuantities[row.variantId] = row.quantityAvailable;
    }
    const branches = [...locations.values()];
    for (const branch of branches) for (const v of pVariants) branch.variantQuantities[idOf(v)] ??= 0;
    const quantity = branches.reduce((sum, b) => sum + b.quantity, 0);
    return { ...product, branches, inventoryKnown: true, quantity, quantityAvailable: quantity,
      quantityOnHand: branches.reduce((sum, b) => sum + b.quantityOnHand, 0), inStock: quantity > 0,
      branchAddress: branches[0]?.address || 'Chưa có hàng tại chi nhánh', branchName: branches[0]?.name || '',
    };
  });
};

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-025 */
const checkAvailability = async (variantId, locationId, requestedQty) => {
  const branch = await validateActiveStoreLocation(locationId);
  if (!variantId || !branch.valid) return { available: false, availableQty: 0, code: branch.code || 'ERR_INVALID_VARIANT', message: branch.message || 'Thiếu biến thể.' };
  const balances = await InventoryBalance.find({ variantId, locationId }).lean();
  let availableQty;
  if (balances.length) {
    availableQty = balances.reduce((sum, b) => sum + Math.max(0, nonnegative(b.quantityOnHand) - nonnegative(b.quantityReserved) - nonnegative(b.quantityUnavailable)), 0);
  } else {
    const [count, reservations] = await Promise.all([
      InventoryItem.countDocuments({ variantId, locationId, status: 'available', condition: { $nin: ['damaged', 'unrepairable', 'missing'] } }),
      InventoryReservation.find({ variantId, locationId, status: 'active' }).select('quantity').lean(),
    ]);
    availableQty = Math.max(0, count - reservations.reduce((sum, r) => sum + nonnegative(r.quantity), 0));
  }
  const available = Number.isInteger(requestedQty) && requestedQty > 0 && availableQty >= requestedQty;
  return { available, availableQty, code: available ? null : 'ERR_INSUFFICIENT_STOCK',
    message: available ? 'Còn hàng khả dụng' : 'Chi nhánh chỉ còn ' + availableQty + ' sản phẩm khả dụng.' };
};
export const checkRentalAvailability = (variantId, locationId, requestedQty = 1, startDate, dueDate) => checkAvailability(variantId, locationId, requestedQty);
export const checkSalesAvailability = (variantId, locationId, requestedQty = 1) => checkAvailability(variantId, locationId, requestedQty);
