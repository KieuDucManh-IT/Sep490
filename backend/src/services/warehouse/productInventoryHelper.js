import mongoose from 'mongoose';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import '../../models/shop/Shop.js';

/**
 * Format địa chỉ chi nhánh/kho từ InventoryLocation hoặc Shop liên kết
 */
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

/**
 * Làm giàu danh sách sản phẩm với số lượng và địa chỉ chi nhánh
 * dựa trên bảng InventoryBalance và InventoryItem
 * @param {Array} products - Danh sách sản phẩm
 * @param {Array} variants - Danh sách biến thể thuộc các sản phẩm
 * @returns {Promise<Array>} Danh sách sản phẩm đã được bổ sung tồn kho & chi nhánh
 */
export const enrichProductsWithInventory = async (products = [], variants = []) => {
  if (!products || !products.length) return [];

  const variantIds = variants.map((v) => v._id).filter(Boolean);

  let balances = [];
  let items = [];

  if (variantIds.length > 0) {
    try {
      [balances, items] = await Promise.all([
        InventoryBalance.find({ variantId: { $in: variantIds } })
          .populate({
            path: 'locationId',
            populate: { path: 'shopId' },
          })
          .lean(),
        InventoryItem.find({
          variantId: { $in: variantIds },
          status: { $nin: ['disposed', 'in_transit'] },
        })
          .populate({
            path: 'locationId',
            populate: { path: 'shopId' },
          })
          .lean(),
      ]);
    } catch (err) {
      console.warn('Lỗi truy vấn tồn kho InventoryBalance / InventoryItem:', err.message);
    }
  }

  // Nhóm balances theo variantId
  const balancesByVariant = new Map();
  for (const b of balances) {
    const vid = String(b.variantId);
    if (!balancesByVariant.has(vid)) balancesByVariant.set(vid, []);
    balancesByVariant.get(vid).push(b);
  }

  // Nhóm items theo variantId
  const itemsByVariant = new Map();
  for (const it of items) {
    const vid = String(it.variantId);
    if (!itemsByVariant.has(vid)) itemsByVariant.set(vid, []);
    itemsByVariant.get(vid).push(it);
  }

  // Nhóm variants theo productId
  const variantsByProduct = new Map();
  for (const v of variants) {
    const pid = String(v.productId);
    if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
    variantsByProduct.get(pid).push(v);
  }

  return products.map((product) => {
    const pid = String(product._id);
    const pVariants = variantsByProduct.get(pid) || [];
    const pBalances = pVariants.flatMap((v) => balancesByVariant.get(String(v._id)) || []);
    const pItems = pVariants.flatMap((v) => itemsByVariant.get(String(v._id)) || []);

    const isIndividual = product.trackingType === 'individual';
    const locationMap = new Map();

    const getOrInitLocation = (loc) => {
      const locId = loc ? String(loc._id || loc) : 'unknown';
      if (!locationMap.has(locId)) {
        locationMap.set(locId, {
          locationId: loc ? (loc._id || loc) : null,
          name: loc?.name || 'Chi nhánh kho',
          type: loc?.type || 'store',
          address: formatLocationAddress(loc),
          city: loc?.shopId?.city || '',
          latitude: loc?.shopId?.latitude ?? null,
          longitude: loc?.shopId?.longitude ?? null,
          balanceOnHand: 0,
          balanceAvailable: 0,
          itemsOnHand: 0,
          itemsAvailable: 0,
        });
      }
      return locationMap.get(locId);
    };

    // Gom số lượng từ InventoryBalance
    for (const b of pBalances) {
      const entry = getOrInitLocation(b.locationId);
      const onHand = Number(b.quantityOnHand) || 0;
      const reserved = Number(b.quantityReserved) || 0;
      const unavailable = Number(b.quantityUnavailable) || 0;
      const available = Math.max(0, onHand - reserved - unavailable);
      entry.balanceOnHand += onHand;
      entry.balanceAvailable += available;
    }

    // Gom số lượng từ InventoryItem
    for (const it of pItems) {
      const entry = getOrInitLocation(it.locationId);
      entry.itemsOnHand += 1;
      const isAvailable =
        it.status === 'available' &&
        !['damaged', 'unrepairable', 'missing'].includes(it.condition);
      if (isAvailable) {
        entry.itemsAvailable += 1;
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
          quantity: locAvailable > 0 ? locAvailable : locOnHand,
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

    const quantity = totalAvailable > 0 ? totalAvailable : totalOnHand;
    const inStock = quantity > 0;

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
