import mongoose from 'mongoose';
import { StockRelocation } from '../../models/warehouse/transfer/StockRelocation.js';
import { StockRelocationDetail } from '../../models/warehouse/transfer/StockRelocationDetail.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import User from '../../models/system/User.js';
import { recordStockMovement } from './inventoryLedgerService.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const roleOf = (user) => String(user?.Role || user?.role || '').toLowerCase().replace(/[\s_-]/g, '');
const manager = (user) => ['warehousemanager', 'admin'].includes(roleOf(user));
const validId = mongoose.isValidObjectId;
const makeCode = () => `DC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
const populated = (query) => query.populate('locationId', 'code name').populate('createdBy', 'FullName Email').populate('assignedStaffId', 'FullName Email');
const details = (id) => StockRelocationDetail.find({ relocationId: id }).sort({ createdAt: 1 })
  .populate({ path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'name productCode trackingType' } })
  .populate('fromStorageId', 'code name type').populate('toStorageId', 'code name type')
  .populate('itemIds', 'itemCode serialNumber condition status').populate('confirmedItemIds', 'itemCode serialNumber condition status');

const centralWarehouse = async (session) => {
  const rows = await InventoryLocation.find({ type: 'warehouse', status: 'active' }).select('_id code name').session(session || null).lean();
  if (rows.length !== 1) throw fail('Cần có đúng một kho tổng đang hoạt động để di chuyển hàng.', 409);
  return rows[0];
};
const load = async (id, user, session) => {
  if (!validId(id)) throw fail('Mã phiếu di chuyển không hợp lệ.');
  let query = StockRelocation.findById(id);
  if (session) query = query.session(session);
  const doc = await populated(query);
  if (!doc) throw fail('Không tìm thấy phiếu di chuyển.', 404);
  if (!manager(user) && String(doc.assignedStaffId?._id || doc.assignedStaffId) !== String(user._id)) throw fail('Phiếu này không được giao cho bạn.', 403);
  return { ...doc.toObject(), items: await details(id) };
};

export const listStockRelocations = async (user, operationType = '') => {
  if (!manager(user) && roleOf(user) !== 'warehousestaff') throw fail('Bạn không có quyền xem phiếu di chuyển.', 403);
  const filter = manager(user) ? {} : { assignedStaffId: user._id };
  if (['split', 'merge'].includes(operationType)) filter.operationType = operationType;
  const rows = await populated(StockRelocation.find(filter).sort({ createdAt: -1 }));
  return Promise.all(rows.map(async (row) => ({ ...row.toObject(), items: await details(row._id) })));
};
export const getStockRelocation = load;
export const listRelocationStaff = () => User.find({ Role: /^warehouse[\s_-]?staff$/i, Status: /^active$/i }).select('FullName Email').sort({ FullName: 1 }).lean();

const storageChain = async (storageId, locationId, session) => {
  const chain = [];
  const visited = new Set();
  let currentId = storageId;
  while (currentId) {
    if (visited.has(String(currentId))) throw fail('Cấu trúc vị trí lưu trữ có vòng lặp.', 409);
    visited.add(String(currentId));
    let query = StorageLocation.findOne({ _id: currentId, locationId, status: 'active' });
    if (session) query = query.session(session);
    const current = await query.lean();
    if (!current) throw fail('Vị trí nguồn hoặc đích không thuộc kho tổng đang hoạt động.', 400);
    chain.push(current);
    currentId = current.parentStorageId;
  }
  if (chain[0]?.type !== 'shelf') throw fail('Chỉ có thể di chuyển hàng từ hoặc đến kệ lưu trữ.', 400);
  return chain;
};

const checkCapacity = async (locationId, lines, session) => {
  const storages = await StorageLocation.find({ locationId }).select('_id parentStorageId maxCapacity').session(session || null).lean();
  const byId = new Map(storages.map((x) => [String(x._id), x]));
  const allVariants = await ProductVariant.find({}).select('productId').populate('productId', 'trackingType').session(session || null).lean();
  const trackedIds = allVariants.filter((variant) => variant.productId?.trackingType !== 'individual').map((variant) => variant._id);
  const balances = trackedIds.length ? await InventoryBalance.find({ locationId, storageId: { $ne: null }, variantId: { $in: trackedIds } }).session(session || null).lean() : [];
  const individualIds = allVariants.filter((variant) => variant.productId?.trackingType === 'individual').map((variant) => variant._id);
  const itemRows = individualIds.length ? await InventoryItem.aggregate([
    { $match: { locationId: new mongoose.Types.ObjectId(locationId), variantId: { $in: individualIds }, storageId: { $ne: null }, status: { $nin: ['disposed', 'in_transit'] }, condition: { $ne: 'missing' } } },
    { $group: { _id: '$storageId', count: { $sum: 1 } } },
  ]).session(session || null) : [];
  const used = new Map();
  const addUsed = (storageId, amount) => {
    const visited = new Set(); let cursor = byId.get(String(storageId));
    while (cursor && !visited.has(String(cursor._id))) {
      visited.add(String(cursor._id));
      used.set(String(cursor._id), (used.get(String(cursor._id)) || 0) + amount);
      cursor = cursor.parentStorageId ? byId.get(String(cursor.parentStorageId)) : null;
    }
  };
  for (const row of balances) addUsed(row.storageId, Math.max(0, row.quantityOnHand));
  for (const row of itemRows) addUsed(row._id, row.count);
  const delta = new Map();
  const addAncestors = (id, amount) => {
    const visited = new Set(); let cursor = byId.get(String(id));
    while (cursor && !visited.has(String(cursor._id))) {
      visited.add(String(cursor._id));
      delta.set(String(cursor._id), (delta.get(String(cursor._id)) || 0) + amount);
      cursor = cursor.parentStorageId ? byId.get(String(cursor.parentStorageId)) : null;
    }
  };
  const pendingIds = await StockRelocation.find({ locationId, status: { $in: ['assigned', 'in_progress'] } }).distinct('_id').session(session || null);
  if (pendingIds.length) {
    const pendingLines = await StockRelocationDetail.find({ relocationId: { $in: pendingIds } }).select('fromStorageId toStorageId quantity').session(session || null).lean();
    for (const line of pendingLines) { addAncestors(line.fromStorageId, -line.quantity); addAncestors(line.toStorageId, line.quantity); }
  }
  for (const line of lines) { addAncestors(line.fromStorageId, -line.quantity); addAncestors(line.toStorageId, line.quantity); }
  for (const storage of storages) {
    if (storage.maxCapacity == null) continue;
    const projected = (used.get(String(storage._id)) || 0) + (delta.get(String(storage._id)) || 0);
    if (projected > storage.maxCapacity) throw fail(`Kệ hoặc khu vực ${storage._id} vượt sức chứa tối đa (${projected}/${storage.maxCapacity}).`, 409);
  }
};

export const createStockRelocation = async (payload, user, validated) => {
  if (!manager(user)) throw fail('Chỉ quản lý kho mới được tạo và giao phiếu di chuyển.', 403);
  const session = await mongoose.startSession(); let id;
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const staff = await User.findOne({ _id: validated.assignedStaffId, Role: /^warehouse[\s_-]?staff$/i, Status: /^active$/i }).session(session);
      if (!staff) throw fail('Nhân viên kho được giao không tồn tại hoặc đã ngừng hoạt động.');
      const variantIds = [...new Set(validated.items.map((x) => x.variantId))];
      const variantRows = await ProductVariant.find({ _id: { $in: variantIds }, status: 'active', isDeleted: { $ne: true } }).populate('productId', 'trackingType status isDeleted').session(session).lean();
      if (variantRows.length !== variantIds.length || variantRows.some((v) => !v.productId || v.productId.status !== 'active' || v.productId.isDeleted)) throw fail('Có biến thể không tồn tại hoặc đã ngừng kinh doanh.');
      const tracking = new Map(variantRows.map((v) => [String(v._id), v.productId.trackingType || 'quantity']));
      for (const line of validated.items) {
        await storageChain(line.fromStorageId, central._id, session);
        await storageChain(line.toStorageId, central._id, session);
        const balance = await InventoryBalance.findOne({ locationId: central._id, storageId: line.fromStorageId, variantId: line.variantId }).session(session);
        if (tracking.get(line.variantId) === 'individual') {
          const items = await InventoryItem.find({ locationId: central._id, storageId: line.fromStorageId, variantId: line.variantId, status: 'available', condition: { $nin: ['damaged', 'unrepairable', 'missing'] } }).sort({ createdAt: 1 }).limit(line.quantity).session(session);
          if (items.length !== line.quantity) throw fail(`Tồn khả dụng tại kệ nguồn không đủ (${items.length}/${line.quantity}).`, 409);
          line.itemIds = items.map((x) => x._id);
          for (const item of items) { item.status = 'reserved'; await item.save({ session }); }
          await InventoryBalance.findOneAndUpdate({ locationId: central._id, storageId: line.fromStorageId, variantId: line.variantId }, { $inc: { quantityReserved: line.quantity } }, { upsert: true, new: true, session, setDefaultsOnInsert: true });
        } else {
          const available = (balance?.quantityOnHand || 0) - (balance?.quantityReserved || 0) - (balance?.quantityUnavailable || 0);
          if (!balance || available < line.quantity) throw fail(`Tồn khả dụng tại kệ nguồn không đủ (${Math.max(0, available)}/${line.quantity}).`, 409);
          balance.quantityReserved += line.quantity; await balance.save({ session });
          line.itemIds = [];
        }
      }
      await checkCapacity(central._id, validated.items, session);
      const [doc] = await StockRelocation.create([{
        relocationCode: makeCode(), locationId: central._id, createdBy: user._id,
        assignedStaffId: staff._id, operationType: validated.operationType, status: 'assigned', note: validated.note,
      }], { session });
      id = doc._id;
      await StockRelocationDetail.insertMany(validated.items.map((line) => ({ relocationId: id, ...line })), { session });
    });
  } finally { await session.endSession(); }
  return load(id, user);
};

export const startStockRelocation = async (id, user) => {
  if (!validId(id)) throw fail('Mã phiếu di chuyển không hợp lệ.');
  const doc = await StockRelocation.findOne({ _id: id, assignedStaffId: user._id, status: 'assigned' });
  if (!doc) throw fail('Phiếu không còn ở trạng thái được nhận thực hiện.', 409);
  doc.status = 'in_progress'; doc.startedAt = new Date(); await doc.save();
  return load(id, user);
};

export const completeStockRelocation = async (id, user, confirmations) => {
  if (!validId(id)) throw fail('Mã phiếu di chuyển không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const doc = await StockRelocation.findOne({ _id: id, assignedStaffId: user._id, status: 'in_progress' }).session(session);
      if (!doc) throw fail('Phiếu chưa được bắt đầu hoặc không được giao cho bạn.', 409);
      const rows = await StockRelocationDetail.find({ relocationId: id }).session(session);
      const incoming = new Map(confirmations.map((x) => [x.detailId, x]));
      if (incoming.size !== rows.length || rows.some((row) => !incoming.has(String(row._id)))) throw fail('Cần xác nhận đầy đủ từng dòng trên phiếu.');
      for (const row of rows) {
        const result = incoming.get(String(row._id));
        const variant = await ProductVariant.findById(row.variantId).populate('productId', 'trackingType').session(session);
        const individual = variant?.productId?.trackingType === 'individual';
        if (result.quantityMoved !== row.quantity) throw fail('Số lượng xác nhận phải khớp số đã được giao; nếu phát hiện chênh lệch hãy báo quản lý kho xử lý phiếu.', 409);
        if (individual && (result.itemIds.length !== row.quantity || result.itemIds.some((itemId) => !row.itemIds.some((reserved) => String(reserved) === itemId)))) throw fail('Danh sách item đã chọn phải khớp số lượng và các item đã được giữ cho phiếu.', 409);
        if (!individual && result.itemIds.length) throw fail('Dòng quản lý theo số lượng không nhận danh sách InventoryItem.');
        if (individual) {
          const items = await InventoryItem.find({ _id: { $in: result.itemIds }, locationId: doc.locationId, storageId: row.fromStorageId, status: 'reserved' }).session(session);
          if (items.length !== row.quantity) throw fail('Có item không còn ở kệ nguồn hoặc không còn được giữ cho phiếu.', 409);
          for (const item of items) { item.storageId = row.toStorageId; item.status = 'available'; await item.save({ session }); }
          const source = await InventoryBalance.findOne({ locationId: doc.locationId, storageId: row.fromStorageId, variantId: row.variantId }).session(session);
          if (!source || source.quantityReserved < row.quantity || source.quantityOnHand < row.quantity) throw fail('Tồn kho nguồn đã thay đổi, không thể hoàn tất phiếu.', 409);
          source.quantityOnHand -= row.quantity; source.quantityReserved -= row.quantity; await source.save({ session });
          await InventoryBalance.findOneAndUpdate({ locationId: doc.locationId, storageId: row.toStorageId, variantId: row.variantId }, { $inc: { quantityOnHand: row.quantity } }, { upsert: true, new: true, session, setDefaultsOnInsert: true });
          for (const item of items) await recordStockMovement({ variantId: row.variantId, itemId: item._id, locationId: doc.locationId, storageId: row.fromStorageId, movementType: 'transfer_out', quantityChange: -1, referenceType: 'stock_relocation', referenceId: doc._id, createdBy: user._id }, session);
          for (const item of items) await recordStockMovement({ variantId: row.variantId, itemId: item._id, locationId: doc.locationId, storageId: row.toStorageId, movementType: 'transfer_in', quantityChange: 1, referenceType: 'stock_relocation', referenceId: doc._id, createdBy: user._id }, session);
        } else {
          const source = await InventoryBalance.findOne({ locationId: doc.locationId, storageId: row.fromStorageId, variantId: row.variantId }).session(session);
          if (!source || source.quantityReserved < row.quantity || source.quantityOnHand < row.quantity) throw fail('Tồn kho nguồn đã thay đổi, không thể hoàn tất phiếu.', 409);
          source.quantityOnHand -= row.quantity; source.quantityReserved -= row.quantity; await source.save({ session });
          await InventoryBalance.findOneAndUpdate({ locationId: doc.locationId, storageId: row.toStorageId, variantId: row.variantId }, { $inc: { quantityOnHand: row.quantity } }, { upsert: true, new: true, session, setDefaultsOnInsert: true });
          await recordStockMovement({ variantId: row.variantId, locationId: doc.locationId, storageId: row.fromStorageId, movementType: 'transfer_out', quantityChange: -row.quantity, referenceType: 'stock_relocation', referenceId: doc._id, createdBy: user._id }, session);
          await recordStockMovement({ variantId: row.variantId, locationId: doc.locationId, storageId: row.toStorageId, movementType: 'transfer_in', quantityChange: row.quantity, referenceType: 'stock_relocation', referenceId: doc._id, createdBy: user._id }, session);
        }
        row.confirmedQuantity = result.quantityMoved; row.confirmedItemIds = result.itemIds; row.confirmedBy = user._id; row.confirmedAt = new Date(); await row.save({ session });
      }
      doc.status = 'completed'; doc.completedAt = new Date(); await doc.save({ session });
    });
  } finally { await session.endSession(); }
  return load(id, user);
};

export const cancelStockRelocation = async (id, user) => {
  if (!manager(user)) throw fail('Chỉ quản lý kho mới được hủy phiếu di chuyển.', 403);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const doc = await StockRelocation.findOne({ _id: id, status: 'assigned' }).session(session);
      if (!doc) throw fail('Chỉ có thể hủy phiếu chưa được nhân viên bắt đầu thực hiện.', 409);
      const rows = await StockRelocationDetail.find({ relocationId: id }).session(session);
      for (const row of rows) {
        const variant = await ProductVariant.findById(row.variantId).populate('productId', 'trackingType').session(session);
        if (variant?.productId?.trackingType === 'individual') await InventoryItem.updateMany({ _id: { $in: row.itemIds }, status: 'reserved' }, { $set: { status: 'available' } }, { session });
        else await InventoryBalance.updateOne({ locationId: doc.locationId, storageId: row.fromStorageId, variantId: row.variantId }, { $inc: { quantityReserved: -row.quantity } }, { session });
      }
      doc.status = 'cancelled'; doc.cancelledAt = new Date(); await doc.save({ session });
    });
  } finally { await session.endSession(); }
  return load(id, user);
};
