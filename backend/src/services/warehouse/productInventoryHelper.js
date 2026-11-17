import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { availableFromBalances } from './orderStockService.js';

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
export const validateActiveStoreLocation = async (locationId, session = null) => {
  const query = locationId ? InventoryLocation.findById(locationId) : null;
  if (query && session) query.session(session);
  const location = query ? await query.lean() : null;
  return isActiveStoreLocation(location)
    ? { valid: true, location, code: null }
    : { valid: false, location, code: 'ERR_BRANCH_UNAVAILABLE', message: 'Chi nhánh không tồn tại, ngừng hoạt động hoặc là kho tổng.' };
};

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-025
 * TASK-010: mọi loại hàng (quantity + individual) chỉ đọc InventoryBalance; khả dụng = Σ max(0, onHand − reserved − unavailable).
 * Balance của hàng individual đã đồng bộ với món (TASK-009) và đã trừ giữ chỗ của đơn → không đếm món nữa. */
export const enrichProductsWithInventory = async (products = [], variants = []) => {
  if (!products.length) return [];
  const variantIds = variants.map(v => v._id);
  const balances = variantIds.length
    ? await InventoryBalance.find({ variantId: { $in: variantIds } }).populate({ path: 'locationId', populate: { path: 'shopId' } }).lean()
    : [];
  const byPair = new Map();
  for (const row of balances) {
    const location = row.locationId;
    if (!isActiveStoreLocation(location)) continue;
    const key = idOf(row.variantId) + ':' + idOf(location);
    if (!byPair.has(key)) byPair.set(key, { variantId: idOf(row.variantId), location, balances: [] });
    byPair.get(key).balances.push(row);
  }
  for (const row of byPair.values()) {
    row.quantityOnHand = row.balances.reduce((sum, b) => sum + nonnegative(b.quantityOnHand), 0);
    row.quantityAvailable = availableFromBalances(row.balances);
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

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-025
 * TASK-010: chỉ đọc balance (bỏ fallback đếm món). Nhận `session` để đọc trong transaction tạo đơn.
 * Đây chỉ là kiểm tra sớm để báo lỗi đẹp; chốt chặn thật là lệnh giữ chỗ nguyên tử (orderStockService.reserveStock). */
const checkAvailability = async (variantId, locationId, requestedQty, session = null) => {
  const branch = await validateActiveStoreLocation(locationId, session);
  if (!variantId || !branch.valid) return { available: false, availableQty: 0, code: branch.code || 'ERR_INVALID_VARIANT', message: branch.message || 'Thiếu biến thể.' };
  const query = InventoryBalance.find({ variantId, locationId });
  if (session) query.session(session);
  const availableQty = availableFromBalances(await query.lean());
  const available = Number.isInteger(requestedQty) && requestedQty > 0 && availableQty >= requestedQty;
  return { available, availableQty, code: available ? null : 'ERR_OUT_OF_STOCK',
    message: available ? 'Còn hàng khả dụng' : 'Chi nhánh chỉ còn ' + availableQty + ' sản phẩm khả dụng.' };
};
export const checkRentalAvailability = (variantId, locationId, requestedQty = 1, startDate, dueDate, session = null) => checkAvailability(variantId, locationId, requestedQty, session);
export const checkSalesAvailability = (variantId, locationId, requestedQty = 1, session = null) => checkAvailability(variantId, locationId, requestedQty, session);
