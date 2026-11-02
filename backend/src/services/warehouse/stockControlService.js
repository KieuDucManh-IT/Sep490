import mongoose from 'mongoose';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import User from '../../models/system/User.js';
import { Stocktake } from '../../models/warehouse/stocktake/Stocktake.js';
import { StocktakeDetail } from '../../models/warehouse/stocktake/StocktakeDetail.js';
import { StockAdjustment } from '../../models/warehouse/adjustment/StockAdjustment.js';
import { StockAdjustmentDetail } from '../../models/warehouse/adjustment/StockAdjustmentDetail.js';
import { validateCreateStocktakeInput, validateStocktakeCountInput } from '../../validations/warehouse/stockControlValidation.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const idValid = (id) => mongoose.Types.ObjectId.isValid(id);
const cleanIds = (value = []) => [...new Set((Array.isArray(value) ? value : []).map(String))];
const makeCode = (prefix) => `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
const roleOf = (user) => String(user?.Role || '').toLowerCase();
const isManager = (user) => ['warehouse_manager', 'admin'].includes(roleOf(user));
const isStaff = (user) => roleOf(user) === 'warehouse_staff';
const isStorageInScope = (storageId, scopedStorageIds) => !scopedStorageIds || scopedStorageIds.has(String(storageId || ''));

const storageScope = async (locationId, requestedIds) => {
  if (!requestedIds?.length) throw fail('Chọn ít nhất một vị trí lưu trữ để kiểm kê.');
  const all = await StorageLocation.find({ locationId }).select('_id parentStorageId status').lean();
  const allById = new Map(all.map((item) => [String(item._id), item]));
  const requested = cleanIds(requestedIds);
  if (requested.some((id) => !idValid(id) || !allById.has(id) || allById.get(id).status !== 'active')) throw fail('Vị trí kiểm kê không thuộc kho hoặc không hoạt động.');
  const selected = new Set(requested);
  const expanded = new Set();
  for (const storage of all) {
    let cursor = storage;
    const visited = new Set();
    while (cursor && !visited.has(String(cursor._id))) {
      const currentId = String(cursor._id);
      if (selected.has(currentId)) { expanded.add(String(storage._id)); break; }
      visited.add(currentId);
      cursor = cursor.parentStorageId ? allById.get(String(cursor.parentStorageId)) : null;
    }
  }
  for (const id of requested) expanded.add(id);
  return { all, expanded };
};

const stocktakePopulation = [
  { path: 'locationId', select: 'code name type' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'assignedStaffId', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
];

const detailsForStocktake = (stocktakeId) => StocktakeDetail.find({ stocktakeId }).sort({ createdAt: 1 })
  .populate({ path: 'variantId', select: 'sku variantName size color productId', populate: { path: 'productId', select: 'productCode name trackingType' } })
  .populate('itemId', 'itemCode serialNumber condition status')
  .populate('storageId', 'code name type');

const adjustmentPopulation = [
  { path: 'locationId', select: 'code name' },
  { path: 'stocktakeId', select: 'stocktakeCode status' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
];

const detailsForAdjustment = (adjustmentId) => StockAdjustmentDetail.find({ adjustmentId }).sort({ createdAt: 1 })
  .populate({ path: 'variantId', select: 'sku variantName productId', populate: { path: 'productId', select: 'productCode name' } })
  .populate('itemId', 'itemCode serialNumber status')
  .populate('storageId', 'code name type');

const loadStocktake = async (id, requester) => {
  if (!idValid(id)) throw fail('Mã phiếu kiểm kê không hợp lệ.');
  const stocktake = await Stocktake.findById(id).populate(stocktakePopulation);
  if (!stocktake) throw fail('Không tìm thấy phiếu kiểm kê.', 404);
  if (isStaff(requester) && String(stocktake.assignedStaffId?._id || stocktake.assignedStaffId) !== String(requester._id)) throw fail('Phiếu kiểm kê này chưa được giao cho bạn.', 403);
  return { ...stocktake.toObject(), items: await detailsForStocktake(id) };
};

export const listWarehouseStaffForStocktake = () => User.find({ Role: /^warehouse_staff$/i, Status: /^active$/i }).select('FullName Email').sort({ FullName: 1 }).lean();

export const createStocktake = async (payload, user) => {
  const { locationId, scopeType, variantIds, storageIds, assignedStaffId } = validateCreateStocktakeInput(payload);
  const location = await InventoryLocation.findOne({ _id: locationId, status: 'active' }).lean();
  if (!location) throw fail('Kho/cửa hàng không tồn tại hoặc không hoạt động.');
  if (scopeType === 'storage_location') await storageScope(locationId, storageIds);
  if (variantIds.length) {
    const count = await ProductVariant.countDocuments({ _id: { $in: variantIds }, status: 'active' });
    if (count !== variantIds.length) throw fail('Một hoặc nhiều biến thể không tồn tại hoặc đã ngừng hoạt động.');
  }
  if (assignedStaffId) {
    if (!await User.exists({ _id: assignedStaffId, Role: /^warehouse_staff$/i, Status: /^active$/i })) throw fail('Nhân viên được giao không hợp lệ.');
  }
  const stocktake = await Stocktake.create({
    stocktakeCode: makeCode('KK'), locationId, scopeType,
    variantIds: scopeType === 'product' ? variantIds : [],
    storageIds: scopeType === 'storage_location' ? storageIds : [],
    createdBy: user._id, assignedStaffId, status: 'draft',
  });
  return loadStocktake(stocktake._id, user);
};

export const listStocktakes = async (user, { status = '' } = {}) => {
  const query = {};
  if (status && ['draft', 'in_progress', 'counted', 'approved', 'cancelled'].includes(status)) query.status = status;
  if (isStaff(user)) query.assignedStaffId = user._id;
  const stocktakes = await Stocktake.find(query).sort({ createdAt: -1 }).populate(stocktakePopulation);
  return Promise.all(stocktakes.map(async (stocktake) => ({ ...stocktake.toObject(), items: await detailsForStocktake(stocktake._id) })));
};

export const getStocktake = loadStocktake;

export const startStocktake = async (stocktakeId, user) => {
  if (!isManager(user)) throw fail('Chỉ quản lý kho mới được bắt đầu kiểm kê.', 403);
  if (!idValid(stocktakeId)) throw fail('Mã phiếu kiểm kê không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const stocktake = await Stocktake.findOne({ _id: stocktakeId, status: 'draft' }).session(session);
      if (!stocktake) throw fail('Phiếu không ở trạng thái nháp.', 409);
      const startedAt = new Date();
      const { expanded } = stocktake.scopeType === 'storage_location'
        ? await storageScope(stocktake.locationId, stocktake.storageIds.map(String))
        : { expanded: null };
      const variantFilter = stocktake.scopeType === 'product' ? { variantId: { $in: stocktake.variantIds } } : {};
      const storageFilter = expanded ? { storageId: { $in: [...expanded] } } : {};
      const [balances, items] = await Promise.all([
        InventoryBalance.find({ locationId: stocktake.locationId, ...variantFilter, ...storageFilter }).session(session).lean(),
        InventoryItem.find({ locationId: stocktake.locationId, status: { $nin: ['disposed', 'renting'] }, ...variantFilter, ...storageFilter }).session(session).lean(),
      ]);
      const variants = await ProductVariant.find({ _id: { $in: [...balances.map((row) => row.variantId), ...items.map((row) => row.variantId)] } })
        .select('productId').populate('productId', 'trackingType').session(session).lean();
      const tracking = new Map(variants.map((variant) => [String(variant._id), variant.productId?.trackingType || 'quantity']));
      const snapshotRows = [];
      for (const balance of balances) {
        if (tracking.get(String(balance.variantId)) === 'individual' || balance.quantityOnHand <= 0) continue;
        snapshotRows.push({ stocktakeId, variantId: balance.variantId, storageId: balance.storageId, systemQuantity: balance.quantityOnHand, countedQuantity: 0, isCounted: false });
      }
      for (const item of items) {
        if (tracking.get(String(item.variantId)) !== 'individual') continue;
        snapshotRows.push({ stocktakeId, variantId: item.variantId, itemId: item._id, storageId: item.storageId, systemQuantity: 1, countedQuantity: 0, isCounted: false });
      }
      await StocktakeDetail.deleteMany({ stocktakeId }, { session });
      if (snapshotRows.length) await StocktakeDetail.insertMany(snapshotRows, { session });
      stocktake.status = 'in_progress';
      stocktake.startedAt = startedAt;
      await stocktake.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return loadStocktake(stocktakeId, user);
};

const normalizeCount = (value, label, max = Number.MAX_SAFE_INTEGER) => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > max) throw fail(`${label} phải là số nguyên từ 0 đến ${max}.`);
  return quantity;
};

export const recordStocktakeCounts = async (stocktakeId, payload, user) => {
  const stocktake = await Stocktake.findById(stocktakeId);
  if (!stocktake || stocktake.status !== 'in_progress') throw fail('Phiếu kiểm kê không còn nhận số đếm.', 409);
  if (isStaff(user) && String(stocktake.assignedStaffId || '') !== String(user._id)) throw fail('Phiếu kiểm kê này chưa được giao cho bạn.', 403);
  if (!isStaff(user) && !isManager(user)) throw fail('Bạn không có quyền ghi nhận kiểm kê.', 403);
  const { items: lines, newItems } = validateStocktakeCountInput(payload);
  const details = await StocktakeDetail.find({ stocktakeId });
  const detailById = new Map(details.map((detail) => [String(detail._id), detail]));
  const variantIds = [...new Set([...details.map((detail) => String(detail.variantId)), ...newItems.map((item) => String(item.variantId || ''))])].filter(Boolean);
  const variants = await ProductVariant.find({ _id: { $in: variantIds } }).select('productId status').populate('productId', 'trackingType').lean();
  const tracking = new Map(variants.map((variant) => [String(variant._id), variant.productId?.trackingType || 'quantity']));
  const timestamp = new Date();
  for (const line of lines) {
    const detail = detailById.get(String(line.detailId || ''));
    if (!detail) throw fail('Có dòng đếm không thuộc phiếu kiểm kê này.');
    const individual = tracking.get(String(detail.variantId)) === 'individual';
    detail.countedQuantity = normalizeCount(line.countedQuantity, 'Số lượng thực tế', individual ? 1 : undefined);
    detail.note = String(line.note || '').trim();
    detail.countedBy = user._id;
    detail.countedAt = timestamp;
    detail.isCounted = true;
    await detail.save();
  }
  for (const item of newItems) {
    const variantId = String(item.variantId || '');
    const storageId = item.storageId ? String(item.storageId) : null;
    if (!idValid(variantId) || !tracking.has(variantId)) throw fail('Biến thể ghi nhận ngoài hệ thống không hợp lệ.');
    if (!storageId) throw fail('Cần chọn vị trí cho mã hàng cá thể mới.');
    const variant = variants.find((row) => String(row._id) === variantId);
    if (!variant || variant.status !== 'active') throw fail('Biến thể kiểm kê không hợp lệ hoặc đã ngừng hoạt động.');
    if (stocktake.scopeType === 'product' && !stocktake.variantIds.some((id) => String(id) === variantId)) throw fail('Biến thể mới nằm ngoài phạm vi kiểm kê.');
    if (storageId && !idValid(storageId)) throw fail('Vị trí lưu trữ không hợp lệ.');
    if (storageId && !await StorageLocation.exists({ _id: storageId, locationId: stocktake.locationId, status: 'active' })) throw fail('Vị trí lưu trữ không thuộc kho hoặc không hoạt động.');
    if (stocktake.scopeType === 'storage_location') {
      const { expanded } = await storageScope(stocktake.locationId, stocktake.storageIds.map(String));
      if (!isStorageInScope(storageId, expanded)) throw fail('Vị trí của mã hàng nằm ngoài phạm vi kiểm kê.');
    }
    const individual = tracking.get(variantId) === 'individual';
    const countedQuantity = individual ? 1 : normalizeCount(item.countedQuantity, 'Số lượng thực tế', Number.MAX_SAFE_INTEGER);
    if (countedQuantity < 1) throw fail('Số lượng thực tế ngoài hệ thống phải lớn hơn 0.');
    const code = String(item.itemCode || '').trim();
    if (individual && (!code || code.length > 100)) throw fail('Mã hàng/serial mới là bắt buộc và tối đa 100 ký tự.');
    if (individual) {
      const exists = await InventoryItem.exists({ itemCode: code });
      const duplicate = await StocktakeDetail.exists({ stocktakeId, countedItemCode: code });
      if (exists || duplicate) throw fail(`Mã hàng ${code} đã tồn tại.`);
    } else if (await StocktakeDetail.exists({ stocktakeId, variantId, storageId, itemId: null, systemQuantity: 0 })) {
      throw fail('Biến thể và vị trí này đã có dòng hàng thừa; hãy gộp số lượng vào dòng đó.');
    }
    await StocktakeDetail.create({
      stocktakeId, variantId, storageId, itemId: null, systemQuantity: 0, countedQuantity,
      countedBy: user._id, countedAt: timestamp, isCounted: true,
      countedItemCode: individual ? code : null, countedSerialNumber: individual ? String(item.serialNumber || '').trim() || null : null,
      note: String(item.note || '').trim(),
    });
  }
  return loadStocktake(stocktakeId, user);
};

export const submitStocktake = async (stocktakeId, user) => {
  const stocktake = await Stocktake.findById(stocktakeId);
  if (!stocktake || stocktake.status !== 'in_progress') throw fail('Phiếu kiểm kê không ở trạng thái đang kiểm.', 409);
  if (isStaff(user) && String(stocktake.assignedStaffId || '') !== String(user._id)) throw fail('Phiếu kiểm kê này chưa được giao cho bạn.', 403);
  if (!isStaff(user) && !isManager(user)) throw fail('Bạn không có quyền gửi kết quả kiểm kê.', 403);
  const uncounted = await StocktakeDetail.countDocuments({ stocktakeId, isCounted: false });
  if (uncounted) throw fail(`Còn ${uncounted} dòng chưa được kiểm đếm.`);
  stocktake.status = 'counted';
  stocktake.completedAt = new Date();
  await stocktake.save();
  return loadStocktake(stocktakeId, user);
};

const signedMovement = (movement) => {
  const amount = Math.abs(Number(movement.quantityChange) || 0);
  if (movement.movementType === 'adjustment') return Number(movement.quantityChange) || 0;
  if (['inbound', 'transfer_in', 'rental_return', 'sales_return'].includes(movement.movementType)) return amount;
  if (['outbound', 'transfer_out', 'sale', 'rental_out', 'disposal'].includes(movement.movementType)) return -amount;
  return Number(movement.quantityChange) || 0;
};

const movementTotal = async (detail, stocktake, { after, before } = {}) => {
  const filter = { locationId: stocktake.locationId, variantId: detail.variantId };
  if (detail.itemId) filter.itemId = detail.itemId;
  else filter.storageId = detail.storageId || null;
  if (after) filter.createdAt = { $gt: after };
  if (before) filter.createdAt = { ...(filter.createdAt || {}), $lte: before };
  const movements = await StockMovement.find(filter).select('movementType quantityChange').lean();
  return movements.reduce((sum, movement) => sum + signedMovement(movement), 0);
};

const currentQuantity = async (detail, individual) => {
  if (individual) {
    if (!detail.itemId) return 0;
    const item = await InventoryItem.findOne({ _id: detail.itemId, locationId: detail.locationId, storageId: detail.storageId || null, status: { $nin: ['disposed', 'renting'] } }).select('_id');
    return item ? 1 : 0;
  }
  const balance = await InventoryBalance.findOne({ locationId: detail.locationId, variantId: detail.variantId, storageId: detail.storageId || null }).select('quantityOnHand');
  return balance?.quantityOnHand || 0;
};

const getCapacitySnapshot = async (locationId, session) => {
  const [location, storages, balances, items] = await Promise.all([
    InventoryLocation.findById(locationId).session(session).lean(),
    StorageLocation.find({ locationId }).select('_id parentStorageId maxCapacity').session(session).lean(),
    InventoryBalance.find({ locationId }).select('storageId variantId quantityOnHand').session(session).lean(),
    InventoryItem.find({ locationId, status: { $nin: ['disposed', 'renting'] } }).select('storageId variantId').session(session).lean(),
  ]);
  const variants = await ProductVariant.find({ _id: { $in: [...balances.map((row) => row.variantId), ...items.map((row) => row.variantId)] } })
    .select('productId').populate('productId', 'trackingType').session(session).lean();
  const tracking = new Map(variants.map((variant) => [String(variant._id), variant.productId?.trackingType || 'quantity']));
  const direct = new Map();
  const add = (storageId, amount) => {
    const key = String(storageId || '');
    direct.set(key, (direct.get(key) || 0) + amount);
  };
  for (const row of balances) if (tracking.get(String(row.variantId)) !== 'individual') add(row.storageId, row.quantityOnHand || 0);
  for (const item of items) if (tracking.get(String(item.variantId)) === 'individual') add(item.storageId, 1);
  const storageById = new Map(storages.map((storage) => [String(storage._id), storage]));
  const usedByStorage = new Map();
  for (const [storageId, amount] of direct) {
    let cursor = storageId ? storageById.get(storageId) : null;
    const visited = new Set();
    while (cursor && !visited.has(String(cursor._id))) {
      const currentId = String(cursor._id);
      visited.add(currentId);
      usedByStorage.set(currentId, (usedByStorage.get(currentId) || 0) + amount);
      cursor = cursor.parentStorageId ? storageById.get(String(cursor.parentStorageId)) : null;
    }
  }
  return { location, storageById, usedByStorage, used: [...direct.values()].reduce((total, amount) => total + amount, 0) };
};

const assertCapacity = (snapshot, adjustmentDetails) => {
  const projectedByStorage = new Map(snapshot.usedByStorage);
  let projectedLocation = snapshot.used;
  for (const detail of adjustmentDetails) {
    projectedLocation += detail.quantityChange;
    let cursor = detail.storageId ? snapshot.storageById.get(String(detail.storageId)) : null;
    const visited = new Set();
    while (cursor && !visited.has(String(cursor._id))) {
      const id = String(cursor._id);
      visited.add(id);
      projectedByStorage.set(id, (projectedByStorage.get(id) || 0) + detail.quantityChange);
      cursor = cursor.parentStorageId ? snapshot.storageById.get(String(cursor.parentStorageId)) : null;
    }
  }
  if (snapshot.location?.maxCapacity != null && projectedLocation > snapshot.location.maxCapacity) throw fail('Điều chỉnh vượt sức chứa tối đa của kho.', 409);
  for (const [id, projected] of projectedByStorage) {
    const storage = snapshot.storageById.get(id);
    if (storage?.maxCapacity != null && projected > storage.maxCapacity) throw fail(`Điều chỉnh vượt sức chứa vị trí ${id}.`, 409);
  }
};

export const approveStocktake = async (stocktakeId, user) => {
  if (!isManager(user)) throw fail('Chỉ quản lý kho mới được duyệt kiểm kê.', 403);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const stocktake = await Stocktake.findOne({ _id: stocktakeId, status: 'counted' }).session(session);
      if (!stocktake) throw fail('Phiếu kiểm kê chưa gửi kết quả hoặc đã được xử lý.', 409);
      const details = await StocktakeDetail.find({ stocktakeId }).session(session);
      if (details.some((detail) => !detail.isCounted)) throw fail('Tất cả dòng phải được kiểm đếm trước khi duyệt.');
      const variantRows = await ProductVariant.find({ _id: { $in: details.map((detail) => detail.variantId) } }).select('productId').populate('productId', 'trackingType').lean();
      const tracking = new Map(variantRows.map((variant) => [String(variant._id), variant.productId?.trackingType || 'quantity']));
      const adjustmentLines = [];
      for (const detail of details) {
        const individual = tracking.get(String(detail.variantId)) === 'individual';
        let movementItemId = detail.itemId || null;
        const movementsTrackable = !individual || Boolean(detail.itemId);
        const countedAt = detail.countedAt || stocktake.startedAt;
        const movementUntilCount = movementsTrackable ? await movementTotal(detail, stocktake, { after: stocktake.startedAt, before: countedAt }) : 0;
        let afterCount = movementsTrackable ? await movementTotal(detail, stocktake, { after: countedAt }) : 0;
        if (individual && detail.itemId && afterCount === 0 && detail.countedQuantity > 0) {
          const itemState = await InventoryItem.findById(detail.itemId).select('locationId storageId status').lean();
          const stillPresent = itemState && String(itemState.locationId) === String(stocktake.locationId)
            && String(itemState.storageId || '') === String(detail.storageId || '')
            && !['disposed', 'renting'].includes(itemState.status);
          if (!stillPresent) afterCount = -detail.countedQuantity;
        }
        const systemAtCount = Math.max(0, detail.systemQuantity + movementUntilCount);
        const expectedNow = Math.max(0, detail.countedQuantity + afterCount);
        const detailContext = { ...detail.toObject(), locationId: stocktake.locationId };
        const before = await currentQuantity(detailContext, individual);
        const change = expectedNow - before;
        detail.systemQuantity = systemAtCount;
        detail.movementAfterCount = afterCount;
        await detail.save({ session });
        if (change) {
          adjustmentLines.push({
            adjustmentId: null, variantId: detail.variantId, itemId: detail.itemId || null,
            storageId: detail.storageId || null, quantityBefore: before, quantityChange: change,
            quantityAfter: before + change, itemCode: detail.countedItemCode || null,
            serialNumber: detail.countedSerialNumber || null,
            reason: detail.note || 'Chênh lệch kiểm kê',
          });
        }
      }
      stocktake.status = 'approved';
      stocktake.approvedBy = user._id;
      await stocktake.save({ session });
      let adjustment = null;
      if (adjustmentLines.length) {
        adjustment = await StockAdjustment.create([{
          adjustmentCode: makeCode('DC'), locationId: stocktake.locationId,
          stocktakeId: stocktake._id, reason: `Điều chỉnh từ kiểm kê ${stocktake.stocktakeCode}`,
          createdBy: user._id, status: 'requested',
        }], { session }).then((rows) => rows[0]);
        await StockAdjustmentDetail.insertMany(adjustmentLines.map((line) => ({ ...line, adjustmentId: adjustment._id })), { session });
      }
      result = { stocktakeId: stocktake._id, adjustmentId: adjustment?._id || null };
    });
  } finally {
    await session.endSession();
  }
  return { stocktake: await loadStocktake(result.stocktakeId, user), adjustment: result.adjustmentId ? await getStockAdjustment(result.adjustmentId) : null };
};

export const listStockAdjustments = async ({ status = '' } = {}) => {
  const query = {};
  if (status && ['requested', 'approved', 'rejected', 'applied', 'cancelled'].includes(status)) query.status = status;
  const adjustments = await StockAdjustment.find(query).sort({ createdAt: -1 }).populate(adjustmentPopulation);
  return Promise.all(adjustments.map(async (adjustment) => ({ ...adjustment.toObject(), items: await detailsForAdjustment(adjustment._id) })));
};

export const getStockAdjustment = async (adjustmentId) => {
  if (!idValid(adjustmentId)) throw fail('Mã phiếu điều chỉnh không hợp lệ.');
  const adjustment = await StockAdjustment.findById(adjustmentId).populate(adjustmentPopulation);
  if (!adjustment) throw fail('Không tìm thấy phiếu điều chỉnh.', 404);
  return { ...adjustment.toObject(), items: await detailsForAdjustment(adjustmentId) };
};

export const decideStockAdjustment = async (adjustmentId, user, decision, note = '') => {
  if (!isManager(user)) throw fail('Chỉ quản lý kho mới được duyệt điều chỉnh.', 403);
  if (!['approve', 'reject'].includes(decision)) throw fail('Quyết định không hợp lệ.');
  const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, status: 'requested' });
  if (!adjustment) throw fail('Phiếu điều chỉnh không ở trạng thái chờ duyệt.', 409);
  adjustment.status = decision === 'approve' ? 'approved' : 'rejected';
  adjustment.approvedBy = user._id;
  adjustment.approvedAt = new Date();
  if (note) adjustment.reason = `${adjustment.reason}\n${decision === 'approve' ? 'Duyệt' : 'Từ chối'}: ${String(note).trim()}`;
  await adjustment.save();
  return getStockAdjustment(adjustmentId);
};

export const applyStockAdjustment = async (adjustmentId, user) => {
  if (!isManager(user)) throw fail('Chỉ quản lý kho mới được áp dụng điều chỉnh.', 403);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, status: 'approved' }).session(session);
      if (!adjustment) throw fail('Phiếu điều chỉnh chưa được duyệt hoặc đã được áp dụng.', 409);
      const details = await StockAdjustmentDetail.find({ adjustmentId }).session(session);
      const capacitySnapshot = await getCapacitySnapshot(adjustment.locationId, session);
      assertCapacity(capacitySnapshot, details);
      const variants = await ProductVariant.find({ _id: { $in: details.map((detail) => detail.variantId) } }).select('productId').populate('productId', 'trackingType').lean();
      const tracking = new Map(variants.map((variant) => [String(variant._id), variant.productId?.trackingType || 'quantity']));
      for (const detail of details) {
        const individual = tracking.get(String(detail.variantId)) === 'individual';
        let movementItemId = detail.itemId || null;
        if (detail.quantityAfter < 0 || detail.quantityAfter !== detail.quantityBefore + detail.quantityChange) throw fail('Dữ liệu số lượng điều chỉnh không hợp lệ.');
        const quantityBalance = await InventoryBalance.findOne({ locationId: adjustment.locationId, variantId: detail.variantId, storageId: detail.storageId || null }).session(session);
        if (!individual) {
          const currentOnHand = quantityBalance?.quantityOnHand || 0;
          if (currentOnHand !== detail.quantityBefore) throw fail('Tồn kho đã thay đổi sau khi duyệt điều chỉnh. Hãy kiểm kê lại trước khi áp dụng.', 409);
        }
        if (individual) {
          if (detail.itemId && detail.quantityChange === -1) {
            const item = await InventoryItem.findOneAndUpdate({ _id: detail.itemId, locationId: adjustment.locationId, storageId: detail.storageId || null, status: { $nin: ['disposed', 'renting'] } }, { $set: { status: 'disposed' } }, { new: true, session });
            if (!item) throw fail('Mã hàng cá thể đã thay đổi vị trí/trạng thái sau khi duyệt. Tạo lại phiếu kiểm kê.', 409);
          } else if (!detail.itemId && detail.quantityChange > 0) {
            if (!detail.itemCode) throw fail('Thiếu mã hàng cho cá thể phát hiện thừa.');
            const [createdItem] = await InventoryItem.create([{
              variantId: detail.variantId, locationId: adjustment.locationId, storageId: detail.storageId,
              itemCode: detail.itemCode, serialNumber: detail.serialNumber || undefined,
              condition: 'new', status: 'available',
            }], { session });
            movementItemId = createdItem._id;
          } else if (detail.quantityChange !== 0) throw fail('Chênh lệch cá thể phải là một mã hàng cụ thể.');
        }
        if (!individual && detail.quantityChange < 0) {
          const required = -detail.quantityChange;
          if (!quantityBalance || quantityBalance.quantityOnHand - required < quantityBalance.quantityReserved + quantityBalance.quantityUnavailable) throw fail('Không thể giảm tồn dưới số lượng đã giữ/chưa khả dụng.', 409);
          quantityBalance.quantityOnHand -= required;
          await quantityBalance.save({ session });
        } else if (!individual && detail.quantityChange > 0) {
          await InventoryBalance.findOneAndUpdate(
            { locationId: adjustment.locationId, variantId: detail.variantId, storageId: detail.storageId || null },
            { $inc: { quantityOnHand: detail.quantityChange } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, session }
          );
        }
        await StockMovement.create([{
          variantId: detail.variantId, itemId: movementItemId, locationId: adjustment.locationId,
          storageId: detail.storageId || null, movementType: 'adjustment', quantityChange: detail.quantityChange,
          referenceType: 'stock_adjustment', referenceId: adjustment._id, createdBy: user._id,
        }], { session });
      }
      adjustment.status = 'applied';
      await adjustment.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return getStockAdjustment(adjustmentId);
};
