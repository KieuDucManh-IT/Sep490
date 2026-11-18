import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { getBalances, sumAvailable, sumByVariantLocation } from './balanceQueryService.js';

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
 * TASK-011: chỉ đọc balance qua balanceQueryService (mọi loại hàng), chỉ chi nhánh `store` + `active`.
 * Trả thêm `variantAvailability: { [variantId]: { total, byLocation } }`; giữ nguyên các field cũ cho giao diện. */
export const enrichProductsWithInventory = async (products = [], variants = []) => {
  if (!products.length) return [];
  const variantIds = variants.map(v => v._id);
  const stores = variantIds.length
    ? (await InventoryLocation.find({ type: 'store', status: 'active' }).populate('shopId').lean()).filter(isActiveStoreLocation)
    : [];
  const storeById = new Map(stores.map(loc => [idOf(loc), loc]));
  const balances = stores.length ? await getBalances({ locationIds: stores.map(loc => loc._id), variantIds }) : [];
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

    let totalOnHand = 0;
    let totalAvailable = 0;
    const branches = [];

    for (const [locId, entry] of locationMap.entries()) {
      let locOnHand = 0;
      let locAvailable = 0;

      if (isIndividual) {
        locOnHand = entry.itemsOnHand > 0 ? entry.itemsOnHand : entry.balanceOnHand;
        locAvailable = entry.itemsOnHand > 0 ? entry.itemsAvailable : entry.balanceAvailable;
      } else {
        locOnHand = entry.balanceOnHand > 0 ? entry.balanceOnHand : entry.itemsOnHand;
        locAvailable = entry.balanceOnHand > 0 ? entry.balanceAvailable : entry.itemsAvailable;
      }

      // Bỏ kho tổng, chỉ lấy ở các chi nhánh (store / showroom)
      const nameLower = (entry.name || '').toLowerCase();
      const typeLower = (entry.type || '').toLowerCase();
      const isWarehouse =
        typeLower === 'warehouse' ||
        nameLower.includes('kho tổng') ||
        nameLower.includes('kho tong') ||
        nameLower.includes('kho trung tâm');

      if (!isWarehouse && (locOnHand > 0 || locAvailable > 0 || locationMap.size === 1)) {
        branches.push({
          locationId: entry.locationId,
          name: entry.name,
          type: entry.type,
          address: entry.address,
          city: entry.city,
          latitude: entry.latitude,
          longitude: entry.longitude,
          quantityOnHand: locOnHand,
          quantityAvailable: locAvailable,
          quantity: locAvailable,
        });

        totalOnHand += locOnHand;
        totalAvailable += locAvailable;
      }
    }

    // Xây dựng địa chỉ chi nhánh hiển thị
    let branchAddress = '';
    let branchName = '';
    if (branches.length > 0) {
      const firstBranch = branches[0];
      branchName = firstBranch.name;
      const addresses = branches.map((b) => b.address).filter(Boolean);
      if (addresses.length === 1) {
        branchAddress = addresses[0];
      } else if (addresses.length > 1) {
        branchAddress = `${addresses[0]} (+${addresses.length - 1} chi nhánh khác)`;
      } else {
        branchAddress = firstBranch.name || '';
      }
    }

    // Fallback về shopId của Product nếu chưa có địa chỉ từ inventory location
    if (!branchAddress && product.shopId) {
      const s = product.shopId;
      if (typeof s === 'object') {
        const parts = [s.address, s.ward, s.city].filter(Boolean);
        if (parts.length > 0) branchAddress = parts.join(', ');
        else if (s.name) branchAddress = s.name;
        if (!branchName && s.name) branchName = s.name;
      }
    }

    if (!branchAddress) {
      branchAddress = 'Chưa có hàng tại chi nhánh';
    }

    const quantity = totalAvailable;
    const inStock = totalAvailable > 0;

    return {
      ...product,
      quantity,
      quantityOnHand: totalOnHand,
      quantityAvailable: totalAvailable,
      branchAddress,
      branchName: branchName || product.brand || 'Chi nhánh Vestora',
      branches,
      inStock,
    };
  });
};

/**
 * Kiểm tra khả dụng tồn kho thuê của biến thể tại một chi nhánh
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-003
 * @param {string|mongoose.Types.ObjectId} variantId
 * @param {string|mongoose.Types.ObjectId} locationId
 * @param {number} requestedQty
 * @param {Date|string} [startDate]
 * @param {Date|string} [dueDate]
 * @returns {Promise<{ available: boolean, availableQty: number, message: string }>}
 */
export const checkRentalAvailability = async (
  variantId,
  locationId,
  requestedQty = 1,
  startDate,
  dueDate
) => {
  if (!variantId || !locationId) {
    return {
      available: false,
      availableQty: 0,
      message: 'Thiếu thông tin biến thể hoặc chi nhánh',
    };
  }

  // 1. Kiểm tra số dư khả dụng từ InventoryBalance
  const balances = await InventoryBalance.find({
    variantId,
    locationId,
  }).lean();

  let totalAvailable = 0;
  for (const b of balances) {
    const avail = Math.max(
      0,
      (b.quantityOnHand || 0) -
      (b.quantityReserved || 0) -
      (b.quantityUnavailable || 0)
    );
    totalAvailable += avail;
  }

  // 2. Nếu balances chưa có, fallback kiểm tra số lượng hiện vật thực tế InventoryItem
  if (totalAvailable < requestedQty) {
    const availableItemsCount = await InventoryItem.countDocuments({
      variantId,
      locationId,
      status: 'available',
      condition: { $nin: ['damaged', 'unrepairable', 'missing'] },
    });
    totalAvailable = Math.max(totalAvailable, availableItemsCount);
  }

  const isAvailable = totalAvailable >= requestedQty;
  return {
    available: isAvailable,
    availableQty: totalAvailable,
    message: isAvailable
      ? 'Còn hàng khả dụng để thuê'
      : `Số lượng khả dụng tại chi nhánh (${totalAvailable}) không đủ đáp ứng yêu cầu (${requestedQty})`,
  };
};

/**
 * Kiểm tra khả dụng tồn kho bán của biến thể tại một chi nhánh
 * @param {string|mongoose.Types.ObjectId} variantId
 * @param {string|mongoose.Types.ObjectId} locationId
 * @param {number} requestedQty
 * @returns {Promise<{ available: boolean, availableQty: number, message: string }>}
 */
export const checkSalesAvailability = async (
  variantId,
  locationId,
  requestedQty = 1
) => {
  if (!variantId || !locationId) {
    return {
      available: false,
      availableQty: 0,
      message: 'Thiếu thông tin biến thể hoặc chi nhánh',
    };
  }

  // 1. Kiểm tra số dư khả dụng từ InventoryBalance
  const balances = await InventoryBalance.find({
    variantId,
    locationId,
  }).lean();

  let totalAvailable = 0;
  for (const b of balances) {
    const avail = Math.max(
      0,
      (b.quantityOnHand || 0) -
      (b.quantityReserved || 0) -
      (b.quantityUnavailable || 0)
    );
    totalAvailable += avail;
  }

  // 2. Nếu balances chưa có, fallback kiểm tra số lượng hiện vật thực tế InventoryItem
  if (totalAvailable < requestedQty) {
    const availableItemsCount = await InventoryItem.countDocuments({
      variantId,
      locationId,
      status: 'available',
      condition: { $nin: ['damaged', 'unrepairable', 'missing'] },
    });
    totalAvailable = Math.max(totalAvailable, availableItemsCount);
  }

  const isAvailable = totalAvailable >= requestedQty;
  return {
    available: isAvailable,
    availableQty: totalAvailable,
    message: isAvailable
      ? 'Còn hàng khả dụng để mua'
      : `Số lượng khả dụng tại chi nhánh (${totalAvailable}) không đủ đáp ứng yêu cầu mua (${requestedQty})`,
  };
};


