import mongoose from 'mongoose';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { InboundReceiptDetail } from '../../models/warehouse/inbound/InboundReceiptDetail.js';

const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const keyOf = (locationId, storageId, variantId) => `${locationId}:${storageId || 'none'}:${variantId}`;
const statusUnavailable = (item) => ['maintenance', 'unavailable'].includes(item.status) || ['damaged', 'unrepairable'].includes(item.condition);
const categoryNamesForProduct = (product) => {
  const categories = Array.isArray(product?.categoryId) ? product.categoryId : product?.categoryId ? [product.categoryId] : [];
  return categories.map((category) => category?.name).filter(Boolean).join(', ');
};

const storageNodeAtLevel = (storageId, level, storageById) => {
  if (!storageId) return null;
  let cursor = storageById.get(String(storageId));
  let fallback = cursor || null;
  const visited = new Set();
  while (cursor && !visited.has(String(cursor._id))) {
    visited.add(String(cursor._id));
    if (cursor.type === level || cursor.type === 'temporary_area') return cursor;
    cursor = cursor.parentStorageId ? storageById.get(String(cursor.parentStorageId)) : null;
  }
  return fallback;
};

const storagePathFor = (storageId, storageById) => {
  if (!storageId) return 'Chưa gán vị trí';
  const parts = [];
  const visited = new Set();
  let cursor = storageById.get(String(storageId));
  while (cursor && !visited.has(String(cursor._id))) {
    visited.add(String(cursor._id));
    parts.unshift(cursor.code || cursor.name);
    cursor = cursor.parentStorageId ? storageById.get(String(cursor.parentStorageId)) : null;
  }
  return parts.length ? parts.join(' / ') : 'Không tìm thấy vị trí';
};

export const getInventoryReport = async ({ locationId = '', storageLevel = 'shelf', itemLevel = 'variant' } = {}) => {
  if (locationId && !mongoose.isValidObjectId(locationId)) throw invalid('Kho/cửa hàng không hợp lệ.');
  if (!['zone', 'row', 'shelf'].includes(storageLevel)) throw invalid('Cấp vị trí không hợp lệ.');
  if (!['product', 'variant'].includes(itemLevel)) throw invalid('Cấp mặt hàng không hợp lệ.');
  const locations = await InventoryLocation.find().populate('managerId', 'FullName Email').sort({ name: 1 }).lean();
  const selectedLocations = locationId ? locations.filter((location) => String(location._id) === String(locationId)) : locations;
  const locationIds = selectedLocations.map((location) => location._id);
  const storageLocations = await StorageLocation.find(locationId ? { locationId } : {}).select('_id code name type parentStorageId').lean();
  const locationById = new Map(selectedLocations.map((location) => [String(location._id), location]));
  const storageById = new Map(storageLocations.map((storage) => [String(storage._id), storage]));
  if (!locationIds.length) return { items: [], summary: { totalOnHand: 0, totalAvailable: 0, totalReserved: 0, totalUnavailable: 0 }, locations };

  const [balances, individualItems] = await Promise.all([
    InventoryBalance.find({ locationId: { $in: locationIds } }).lean(),
    InventoryItem.find({ locationId: { $in: locationIds }, status: { $nin: ['disposed', 'renting', 'in_transit'] } }).lean(),
  ]);
  const variantIds = [...new Set([...balances, ...individualItems].map((row) => String(row.variantId)))];
  const variants = await ProductVariant.find({ _id: { $in: variantIds } })
    .select('sku size color productId')
    .populate({ path: 'productId', select: 'productCode name trackingType tag categoryId', populate: { path: 'categoryId', select: 'name' } })
    .lean();
  const variantById = new Map(variants.map((variant) => [String(variant._id), variant]));
  const grouped = new Map();

  const ensureQuantityRow = (location, storageId, variant) => {
    const key = keyOf(location._id, storageId, variant._id);
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        trackingType: 'quantity',
        locationId: location._id,
        locationCode: location.code,
        locationName: location.name,
        locationType: location.type,
        managerName: location.managerId?.FullName || '',
        storageId: storageId || null,
        storagePath: storagePathFor(storageId, storageById),
        productCode: variant.productId?.productCode || '',
        productName: variant.productId?.name || 'Sản phẩm đã xóa',
        categoryName: categoryNamesForProduct(variant.productId),
        productId: variant.productId?._id || variant.productId || null,
        variantId: variant._id,
        sku: variant.sku,
        size: variant.size || '',
        color: variant.color || '',
        itemCode: '',
        serialNumber: '',
        condition: '',
        itemStatus: '',
        quantityOnHand: 0,
        quantityAvailable: 0,
        quantityReserved: 0,
        quantityUnavailable: 0,
      });
    }
    return grouped.get(key);
  };

  for (const balance of balances) {
    const variant = variantById.get(String(balance.variantId));
    const location = locationById.get(String(balance.locationId));
    if (!variant || variant.productId?.trackingType === 'individual' || !location) continue;
    const row = ensureQuantityRow(location, balance.storageId, variant);
    row.quantityOnHand += balance.quantityOnHand || 0;
    row.quantityReserved += balance.quantityReserved || 0;
    row.quantityUnavailable += balance.quantityUnavailable || 0;
  }

  const individualGroups = new Map();
  for (const item of individualItems) {
    const variant = variantById.get(String(item.variantId));
    const location = locationById.get(String(item.locationId));
    if (!variant || variant.productId?.trackingType !== 'individual' || !location) continue;
    const unavailable = statusUnavailable(item);
    const key = keyOf(location._id, item.storageId, variant._id);
    if (!individualGroups.has(key)) individualGroups.set(key, {
      key,
      trackingType: 'individual',
      locationId: location._id,
      locationCode: location.code,
      locationName: location.name,
      locationType: location.type,
      managerName: location.managerId?.FullName || '',
      storageId: item.storageId || null,
      storagePath: storagePathFor(item.storageId, storageById),
      productCode: variant.productId?.productCode || '',
      productName: variant.productId?.name || 'Sản phẩm đã xóa',
      categoryName: categoryNamesForProduct(variant.productId),
      productId: variant.productId?._id || variant.productId || null,
      variantId: variant._id,
      sku: variant.sku,
      size: variant.size || '',
      color: variant.color || '',
      itemCount: 0,
      quantityOnHand: 0,
      quantityAvailable: 0,
      quantityReserved: 0,
      quantityUnavailable: 0,
    });
    const row = individualGroups.get(key);
    row.itemCount += 1;
    row.quantityOnHand += 1;
    if (unavailable) row.quantityUnavailable += 1;
    else if (item.status === 'reserved') row.quantityReserved += 1;
    else if (item.status === 'available') row.quantityAvailable += 1;
  }

  for (const row of grouped.values()) {
    row.quantityAvailable = Math.max(0, row.quantityOnHand - row.quantityReserved - row.quantityUnavailable);
  }
  const baseRows = [...grouped.values(), ...individualGroups.values()];
  const rollups = new Map();
  for (const source of baseRows) {
    const storage = storageNodeAtLevel(source.storageId, storageLevel, storageById);
    const dimensionId = itemLevel === 'product' ? source.productId : source.variantId;
    const key = `${source.locationId}:${storage?._id || 'none'}:${dimensionId || 'unknown'}`;
    if (!rollups.has(key)) {
      rollups.set(key, {
        ...source,
        key,
        itemLevel,
        storageLevel,
        storageId: storage?._id || null,
        storagePath: storagePathFor(storage?._id, storageById),
        sku: itemLevel === 'product' ? '' : source.sku,
        size: itemLevel === 'product' ? '' : source.size,
        color: itemLevel === 'product' ? '' : source.color,
        variantId: itemLevel === 'product' ? null : source.variantId,
        itemCount: 0,
        quantityOnHand: 0,
        quantityAvailable: 0,
        quantityReserved: 0,
        quantityUnavailable: 0,
      });
    }
    const row = rollups.get(key);
    row.quantityOnHand += source.quantityOnHand || 0;
    row.quantityAvailable += source.quantityAvailable || 0;
    row.quantityReserved += source.quantityReserved || 0;
    row.quantityUnavailable += source.quantityUnavailable || 0;
    row.itemCount += source.itemCount || 0;
  }
  const items = [...rollups.values()]
    .filter((row) => row.quantityOnHand > 0 || row.quantityReserved > 0 || row.quantityUnavailable > 0)
    .sort((a, b) => `${a.locationCode} ${a.storagePath} ${a.productName} ${a.sku} ${a.key}`.localeCompare(`${b.locationCode} ${b.storagePath} ${b.productName} ${b.sku} ${b.key}`, 'vi'));
  const summary = items.reduce((total, row) => ({
    totalOnHand: total.totalOnHand + row.quantityOnHand,
    totalAvailable: total.totalAvailable + row.quantityAvailable,
    totalReserved: total.totalReserved + row.quantityReserved,
    totalUnavailable: total.totalUnavailable + row.quantityUnavailable,
  }), { totalOnHand: 0, totalAvailable: 0, totalReserved: 0, totalUnavailable: 0 });
  return { items, summary, locations };
};

export const getIndividualItemDetails = async ({ locationId, storageId, variantId, productId, itemLevel = 'variant', availableOnly = false }) => {
  if (!mongoose.isValidObjectId(locationId)) throw invalid('Kho/cửa hàng không hợp lệ.');
  if (storageId && storageId !== 'none' && !mongoose.isValidObjectId(storageId)) throw invalid('Vị trí lưu trữ không hợp lệ.');
  if (!['product', 'variant'].includes(itemLevel)) throw invalid('Cấp mặt hàng không hợp lệ.');
  let variantIds;
  if (itemLevel === 'product') {
    if (!mongoose.isValidObjectId(productId)) throw invalid('Sản phẩm không hợp lệ.');
    const variants = await ProductVariant.find({ productId }).select('_id');
    if (!variants.length) return [];
    variantIds = variants.map((variant) => variant._id);
  } else {
    if (!mongoose.isValidObjectId(variantId)) throw invalid('Biến thể không hợp lệ.');
    const variant = await ProductVariant.findById(variantId).select('_id');
    if (!variant) throw invalid('Không tìm thấy biến thể.');
    variantIds = [variant._id];
  }
  const onlyAvailable = availableOnly === true || String(availableOnly).toLowerCase() === 'true';
  const query = { locationId, variantId: { $in: variantIds }, status: onlyAvailable ? 'available' : { $nin: ['disposed', 'renting', 'in_transit'] } };
  if (storageId === 'none' || !storageId) query.storageId = null;
  else {
    const storageLocations = await StorageLocation.find({ locationId }).select('_id parentStorageId').lean();
    const storageById = new Map(storageLocations.map((storage) => [String(storage._id), storage]));
    if (!storageById.has(String(storageId))) throw invalid('Vị trí không thuộc kho/cửa hàng đã chọn.');
    const descendantIds = storageLocations.filter((storage) => {
      let cursor = storage;
      const visited = new Set();
      while (cursor && !visited.has(String(cursor._id))) {
        if (String(cursor._id) === String(storageId)) return true;
        visited.add(String(cursor._id));
        cursor = cursor.parentStorageId ? storageById.get(String(cursor.parentStorageId)) : null;
      }
      return false;
    }).map((storage) => storage._id);
    query.storageId = { $in: descendantIds };
  }
  const rows = await InventoryItem.find(query).select('itemCode serialNumber condition status inboundReceiptDetail').populate('variantId', 'sku size color').populate({ path: 'inboundReceiptDetail', select: 'receiptDetailCode receiptId', populate: { path: 'receiptId', select: 'receiptCode' } }).sort({ itemCode: 1 }).lean();
  const missingReceiptCodes = rows.filter((row) => row.inboundReceiptDetail && !row.inboundReceiptDetail.receiptDetailCode);
  const receiptIds = [...new Set(missingReceiptCodes.map((row) => String(row.inboundReceiptDetail.receiptId?._id || row.inboundReceiptDetail.receiptId)).filter(Boolean))];
  for (const receiptId of receiptIds) {
    const receiptCode = missingReceiptCodes.find((row) => String(row.inboundReceiptDetail.receiptId?._id || row.inboundReceiptDetail.receiptId) === receiptId)?.inboundReceiptDetail.receiptId?.receiptCode;
    const details = await InboundReceiptDetail.find({ receiptId }).sort({ createdAt: 1, _id: 1 }).select('_id receiptDetailCode').lean();
    const occupied = new Set(details.map((detail) => detail.receiptDetailCode).filter(Boolean));
    const updates = [];
    for (let index = 0; index < details.length; index += 1) {
      const detail = details[index];
      if (detail.receiptDetailCode) continue;
      const prefix = receiptCode || `PND-${String(receiptId).slice(-8).toUpperCase()}`;
      let code = `${prefix}-${String(index + 1).padStart(2, '0')}`;
      let suffix = 2;
      while (occupied.has(code)) code = `${prefix}-${String(index + 1).padStart(2, '0')}-${suffix++}`;
      occupied.add(code);
      updates.push({ updateOne: { filter: { _id: detail._id }, update: { $set: { receiptDetailCode: code } } } });
      for (const row of missingReceiptCodes) {
        if (String(row.inboundReceiptDetail._id) === String(detail._id)) row.inboundReceiptDetail.receiptDetailCode = code;
      }
    }
    if (updates.length) await InboundReceiptDetail.bulkWrite(updates);
  }
  return rows;
};
