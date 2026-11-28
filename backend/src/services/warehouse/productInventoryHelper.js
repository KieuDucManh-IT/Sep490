import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { sumAvailable, sumByVariantLocation } from './balanceQueryService.js';
import { getCustomerStock } from './customer-stock-query.js';

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
/** TASK-011: nhận diện kho tổng chỉ theo `type` (bỏ đoán theo tên "kho tổng"/"kho trung tâm"). */
export const isWarehouseLocation = (loc) => String(loc?.type || '').toLowerCase() === 'warehouse';
/** Màn khách chỉ tính chi nhánh: InventoryLocation `type: 'store'`, `status: 'active'`, shop (nếu có) còn hoạt động. */
export const isActiveStoreLocation = (loc) => Boolean(loc && loc.type === 'store' && loc.status === 'active' && !loc.isDeleted &&
  (!loc.shopId || !loc.shopId._id ||
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
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-021
 * Customer snapshot: Balance ưu tiên, Item fallback chỉ khi thiếu Balance; chỉ chi nhánh `store` + `active`.
 * Trả thêm `variantAvailability: { [variantId]: { total, byLocation } }`; giữ nguyên các field cũ cho giao diện. */
export const enrichProductsWithInventory = async (products = [], variants = []) => {
  if (!products.length) return [];
  const variantIds = variants.map(v => v._id);
  const stores = variantIds.length
    ? (await InventoryLocation.find({ type: 'store', status: 'active' }).populate('shopId').lean()).filter(isActiveStoreLocation)
    : [];
  const storeById = new Map(stores.map(loc => [idOf(loc), loc]));
  const balances = stores.length ? await getCustomerStock({ locationIds: stores.map(loc => loc._id), variantIds }) : [];
  const availability = sumByVariantLocation(balances);
  return products.map(product => {
    const pVariants = variants.filter(v => idOf(v.productId) === idOf(product));
    const variantAvailability = {};
    const locations = new Map();
    for (const v of pVariants) {
      const vid = idOf(v);
      const entry = availability[vid] || { total: 0, byLocation: {} };
      variantAvailability[vid] = entry;
      for (const [lid, cell] of Object.entries(entry.byLocation)) {
        const loc = storeById.get(lid);
        if (!loc) continue;
        if (!locations.has(lid)) locations.set(lid, {
          locationId: lid, shopId: loc.shopId?._id || loc.shopId || null, name: loc.name,
          type: loc.type, status: loc.status, address: formatLocationAddress(loc),
          city: loc.shopId?.city || loc.city || '', latitude: loc.shopId?.latitude ?? loc.latitude ?? null,
          longitude: loc.shopId?.longitude ?? loc.longitude ?? null,
          quantityOnHand: 0, quantityAvailable: 0, quantity: 0, variantQuantities: {},
        });
        const branch = locations.get(lid);
        branch.quantityOnHand += cell.onHand;
        branch.quantityAvailable += cell.available;
        branch.quantity += cell.available;
        branch.variantQuantities[vid] = cell.available;
      }
    }
    const branches = [...locations.values()];
    for (const branch of branches) for (const v of pVariants) branch.variantQuantities[idOf(v)] ??= 0;
    const quantity = branches.reduce((sum, b) => sum + b.quantity, 0);
    return { ...product, branches, variantAvailability, inventoryKnown: true, quantity, quantityAvailable: quantity,
      quantityOnHand: branches.reduce((sum, b) => sum + b.quantityOnHand, 0), inStock: quantity > 0,
      branchAddress: branches[0]?.address || 'Chưa có hàng tại chi nhánh', branchName: branches[0]?.name || '',
    };
  });
};

/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-021
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-023
 * Kiểm tra snapshot Balance-first/Item fallback. Nhận `session` để đọc trong transaction tạo đơn.
 * Đây chỉ là kiểm tra sớm để báo lỗi đẹp; chốt chặn thật là lệnh giữ chỗ nguyên tử (orderStockService.reserveStock). */
const checkAvailability = async (variantId, locationId, requestedQty, session = null) => {
  const branch = await validateActiveStoreLocation(locationId, session);
  if (!variantId || !branch.valid) return { available: false, availableQty: 0, code: branch.code || 'ERR_INVALID_VARIANT', message: branch.message || 'Thiếu biến thể.' };
  const availableQty = sumAvailable(await getCustomerStock({ locationIds: [locationId], variantIds: [variantId] }, session));
  const available = Number.isInteger(requestedQty) && requestedQty > 0 && availableQty >= requestedQty;
  return { available, availableQty, code: available ? null : 'ERR_OUT_OF_STOCK',
    message: available ? 'Còn hàng khả dụng' : 'Chi nhánh chỉ còn ' + availableQty + ' sản phẩm khả dụng.' };
};
export const checkRentalAvailability = (variantId, locationId, requestedQty = 1, startDate, dueDate, session = null) => checkAvailability(variantId, locationId, requestedQty, session);
export const checkSalesAvailability = (variantId, locationId, requestedQty = 1, session = null) => checkAvailability(variantId, locationId, requestedQty, session);
