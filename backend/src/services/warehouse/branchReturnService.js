import mongoose from 'mongoose';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Shop } from '../../models/shop/Shop.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
import { StockTransferDetail } from '../../models/warehouse/transfer/StockTransferDetail.js';
import { InboundReceipt } from '../../models/warehouse/inbound/InboundReceipt.js';
import { InboundReceiptDetail } from '../../models/warehouse/inbound/InboundReceiptDetail.js';
import User from '../../models/system/User.js';
import { recordStockMovement } from './inventoryLedgerService.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const roleOf = (user) => String(user?.Role || user?.role || '').trim().toLowerCase().replace(/[\s_-]/g, '').replace('brandmanager', 'branchmanager');
const isManager = (user) => ['warehousemanager', 'admin'].includes(roleOf(user));
const isBranchManager = (user) => ['branchmanager', 'admin'].includes(roleOf(user));
const isWarehouseStaff = (user) => roleOf(user) === 'warehousestaff';
const validId = (id) => mongoose.isValidObjectId(id);
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const makeCode = () => `TH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
const integer = (value, label, min = 0) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) throw fail(`${label} phải là số nguyên từ ${min} trở lên.`);
  return number;
};

const population = [
  { path: 'fromLocationId', select: 'code name type shopId', populate: { path: 'shopId', select: 'name managerId' } },
  { path: 'toLocationId', select: 'code name type' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'assignedStaffId', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
  { path: 'receiptApprovedBy', select: 'FullName Email' },
  { path: 'shippedBy', select: 'FullName Email' },
  { path: 'receivedBy', select: 'FullName Email' },
];
const detailsFor = (id) => StockTransferDetail.find({ transferId: id }).sort({ createdAt: 1 })
  .populate({ path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'name productCode trackingType' } })
  .populate('itemIds', 'itemCode serialNumber condition status')
  .populate('receivedItemIds', 'itemCode serialNumber condition status')
  .populate('damagedItemIds', 'itemCode serialNumber condition status')
  .populate('putawayAllocations.storageId', 'code name type');

const getCentral = async () => {
  const rows = await InventoryLocation.find({ type: 'warehouse', status: 'active' }).select('_id code name maxCapacity').lean();
  if (rows.length !== 1) throw fail('Hệ thống cần có đúng một kho tổng đang hoạt động.', 409);
  return rows[0];
};
const branchLocationFor = async (branchId, user) => {
  const shops = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).select('_id').lean();
  if (!shops.some((shop) => String(shop._id) === String(branchId))) throw fail('Chi nhánh không thuộc quyền quản lý của bạn.', 403);
  const locations = await InventoryLocation.find({ shopId: branchId, type: 'store', status: 'active' }).select('_id shopId code name').lean();
  if (locations.length !== 1) throw fail('Chi nhánh phải có đúng một kho cửa hàng đang hoạt động.', 409);
  return locations[0];
};
const assertBranchAccess = async (transfer, user) => {
  if (isManager(user)) return;
  if (isWarehouseStaff(user) && String(transfer.assignedStaffId?._id || transfer.assignedStaffId) === String(user._id)) return;
  if (!isBranchManager(user)) throw fail('Bạn không có quyền xem phiếu trả hàng.', 403);
  const branch = await InventoryLocation.findById(transfer.fromLocationId).populate('shopId', 'managerId status isDeleted').lean();
  if (!branch?.shopId || branch.shopId.status !== 'ACTIVE' || branch.shopId.isDeleted || String(branch.shopId.managerId) !== String(user._id)) throw fail('Phiếu không thuộc chi nhánh bạn quản lý.', 403);
};
const loadReturn = async (id, user) => {
  if (!validId(id)) throw fail('Mã phiếu trả hàng không hợp lệ.');
  const transfer = await StockTransfer.findOne({ _id: id, direction: 'branch_to_central' }).populate(population);
  if (!transfer) throw fail('Không tìm thấy phiếu trả hàng.', 404);
  await assertBranchAccess(transfer, user);
  return { ...transfer.toObject(), items: await detailsFor(id) };
};

export const listBranchReturns = async (user) => {
  const filter = { direction: 'branch_to_central' };
  if (isWarehouseStaff(user)) filter.assignedStaffId = user._id;
  else if (!isManager(user)) {
    if (!isBranchManager(user)) throw fail('Bạn không có quyền xem phiếu trả hàng.', 403);
    const shops = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).distinct('_id');
    filter.fromLocationId = { $in: await InventoryLocation.find({ shopId: { $in: shops }, type: 'store' }).distinct('_id') };
  }
  const rows = await StockTransfer.find(filter).sort({ createdAt: -1 }).populate(population);
  return Promise.all(rows.map(async (row) => ({ ...row.toObject(), items: await detailsFor(row._id) })));
};

export const getBranchReturn = loadReturn;
export const listBranchReturnStaff = () => User.find({ Role: /^warehouse[\s_-]?staff$/i, Status: /^active$/i }).select('FullName Email').sort({ FullName: 1 }).lean();

export const createBranchReturn = async (payload, user) => {
  if (!isBranchManager(user)) throw fail('Chỉ quản lý chi nhánh mới được tạo phiếu trả hàng.', 403);
  if (!payload || !validId(payload.branchId) || !Array.isArray(payload.items) || !payload.items.length) throw fail('Chọn chi nhánh và ít nhất một mặt hàng cần trả.');
  const seen = new Set();
  const items = payload.items.map((line) => {
    if (!validId(line?.variantId)) throw fail('Biến thể trong phiếu trả không hợp lệ.');
    if (seen.has(String(line.variantId))) throw fail('Mỗi biến thể chỉ được xuất hiện một lần trong phiếu.');
    seen.add(String(line.variantId));
    return { variantId: line.variantId, quantityRequested: integer(line.quantityRequested, 'Số lượng trả', 1), note: String(line.note || '').trim().slice(0, 500) };
  });
  const [branch, central, variants] = await Promise.all([
    branchLocationFor(payload.branchId, user), getCentral(),
    ProductVariant.find({ _id: { $in: items.map((item) => item.variantId) }, status: 'active' }).populate('productId', 'status isDeleted').lean(),
  ]);
  if (variants.length !== items.length || variants.some((v) => !v.productId || v.productId.status !== 'active' || v.productId.isDeleted)) throw fail('Có biến thể không tồn tại hoặc đã ngừng kinh doanh.');
  const session = await mongoose.startSession();
  let transferId;
  try {
    await session.withTransaction(async () => {
      const [transfer] = await StockTransfer.create([{
        transferCode: makeCode(), direction: 'branch_to_central', fromLocationId: branch._id, toLocationId: central._id,
        createdBy: user._id, status: 'requested', note: String(payload.note || '').trim().slice(0, 1000),
      }], { session });
      transferId = transfer._id;
      await StockTransferDetail.insertMany(items.map((item) => ({ transferId, ...item })), { session });
    });
  } finally { await session.endSession(); }
  return loadReturn(transferId, user);
};

export const decideBranchReturn = async (id, payload, user) => {
  if (!validId(id)) throw fail('Mã phiếu trả hàng không hợp lệ.');
  if (!isManager(user)) throw fail('Chỉ quản lý kho tổng mới được duyệt phiếu trả.', 403);
  if (!['approve', 'reject'].includes(payload?.decision)) throw fail('Quyết định duyệt không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: id, direction: 'branch_to_central', status: 'requested' }).session(session);
      if (!transfer) throw fail('Phiếu không còn ở trạng thái chờ duyệt.', 409);
      if (payload.decision === 'reject') {
        transfer.status = 'rejected'; transfer.approvedBy = user._id; transfer.approvedAt = new Date();
        if (payload.note) transfer.note = `${transfer.note || ''}\nTừ chối: ${String(payload.note).trim()}`.trim();
        await transfer.save({ session }); return;
      }
      if (!validId(payload.assignedStaffId)) throw fail('Chọn nhân viên kho tổng phụ trách nhận hàng.');
      const staff = await User.findOne({ _id: payload.assignedStaffId, Role: /^warehouse[\s_-]?staff$/i, Status: /^active$/i }).session(session);
      if (!staff) throw fail('Nhân viên kho không tồn tại hoặc đã ngừng hoạt động.');
      const details = await StockTransferDetail.find({ transferId: id }).session(session);
      const variants = await ProductVariant.find({ _id: { $in: details.map((row) => row.variantId) } }).select('productId').populate('productId', 'trackingType').session(session).lean();
      const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
      const approvalLines = Array.isArray(payload.items) ? payload.items : [];
      if (approvalLines.some((line) => !isRecord(line) || !validId(line.detailId))) throw fail('Dòng duyệt không hợp lệ.');
      const approved = new Map(approvalLines.map((line) => [String(line.detailId), line.quantityApproved]));
      if (approved.size !== details.length || approvalLines.length !== details.length || details.some((row) => !approved.has(String(row._id)))) throw fail('Cần duyệt số lượng cho toàn bộ mặt hàng, mỗi dòng một lần.');
      for (const detail of details) {
        const quantity = integer(approved.get(String(detail._id)), 'Số lượng duyệt');
        if (quantity > detail.quantityRequested) throw fail('Số lượng duyệt không được lớn hơn số lượng chi nhánh yêu cầu.');
        detail.quantityApproved = quantity;
        if (quantity > 0 && tracking.get(String(detail.variantId)) === 'individual') {
          const locked = await InventoryItem.find({ locationId: transfer.fromLocationId, variantId: detail.variantId, status: 'available', condition: { $nin: ['damaged', 'unrepairable', 'missing'] } }).sort({ createdAt: 1 }).limit(quantity).session(session);
          if (locked.length < quantity) throw fail(`Chi nhánh chỉ còn ${locked.length} món đủ điều kiện để trả.`, 409);
          detail.itemIds = locked.map((item) => item._id);
          for (const item of locked) { item.status = 'reserved'; await item.save({ session }); }
        } else if (quantity > 0) {
          const balance = await InventoryBalance.findOne({ locationId: transfer.fromLocationId, storageId: null, variantId: detail.variantId }).session(session);
          const available = (balance?.quantityOnHand || 0) - (balance?.quantityReserved || 0) - (balance?.quantityUnavailable || 0);
          if (!balance || available < quantity) throw fail(`Chi nhánh chỉ còn ${Math.max(0, available)} cái khả dụng để trả.`, 409);
          balance.quantityReserved += quantity;
          await balance.save({ session });
        }
        await detail.save({ session });
      }
      if (!details.some((row) => row.quantityApproved > 0)) throw fail('Cần duyệt số lượng lớn hơn 0 cho ít nhất một mặt hàng.');
      transfer.status = 'approved'; transfer.assignedStaffId = staff._id; transfer.approvedBy = user._id; transfer.approvedAt = new Date();
      if (payload.note) transfer.note = `${transfer.note || ''}\nDuyệt: ${String(payload.note).trim()}`.trim();
      await transfer.save({ session });
    });
  } finally { await session.endSession(); }
  return loadReturn(id, user);
};

export const dispatchBranchReturn = async (id, user) => {
  if (!validId(id)) throw fail('Mã phiếu trả hàng không hợp lệ.');
  if (!isBranchManager(user)) throw fail('Chỉ quản lý chi nhánh mới xác nhận gửi hàng về kho tổng.', 403);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const transfer = await StockTransfer.findOne({ _id: id, direction: 'branch_to_central', status: 'approved' }).session(session);
    if (!transfer) throw fail('Phiếu chưa được duyệt hoặc đã gửi hàng.', 409);
    await assertBranchAccess(transfer, user);
    const details = await StockTransferDetail.find({ transferId: id }).session(session);
    const variants = await ProductVariant.find({ _id: { $in: details.map((row) => row.variantId) } }).select('productId').populate('productId', 'trackingType').session(session).lean();
    const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
    for (const detail of details) {
      const quantity = detail.quantityApproved || 0;
      if (!quantity) continue;
      if (tracking.get(String(detail.variantId)) === 'individual') {
        const locked = await InventoryItem.find({ _id: { $in: detail.itemIds }, locationId: transfer.fromLocationId, variantId: detail.variantId, status: 'reserved' }).session(session);
        if (locked.length !== quantity) throw fail('Một số món đã thay đổi trạng thái, không thể gửi phiếu.', 409);
        for (const item of locked) {
          item.status = 'in_transit'; await item.save({ session });
          await recordStockMovement({ variantId: detail.variantId, itemId: item._id, locationId: transfer.fromLocationId, movementType: 'transfer_out', quantityChange: -1, referenceType: 'stock_transfer', referenceId: transfer._id, createdBy: user._id }, session);
        }
      } else {
        const balance = await InventoryBalance.findOne({ locationId: transfer.fromLocationId, storageId: null, variantId: detail.variantId }).session(session);
        if (!balance || balance.quantityReserved < quantity || balance.quantityOnHand < quantity) throw fail('Tồn chi nhánh đã thay đổi, không thể gửi phiếu.', 409);
        balance.quantityOnHand -= quantity; balance.quantityReserved -= quantity; await balance.save({ session });
        await recordStockMovement({ variantId: detail.variantId, locationId: transfer.fromLocationId, movementType: 'transfer_out', quantityChange: -quantity, referenceType: 'stock_transfer', referenceId: transfer._id, createdBy: user._id }, session);
      }
      detail.quantityShipped = quantity; await detail.save({ session });
    }
    transfer.status = 'shipped'; transfer.shippedBy = user._id; transfer.shippedAt = new Date(); await transfer.save({ session });
  }); } finally { await session.endSession(); }
  return loadReturn(id, user);
};

export const cancelBranchReturn = async (id, user) => {
  if (!validId(id)) throw fail('Mã phiếu trả hàng không hợp lệ.');
  if (!isBranchManager(user)) throw fail('Chỉ quản lý chi nhánh mới được hủy phiếu trả hàng.', 403);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const transfer = await StockTransfer.findOne({ _id: id, direction: 'branch_to_central', status: 'approved' }).session(session);
    if (!transfer) throw fail('Chỉ có thể hủy phiếu đã duyệt nhưng chưa gửi hàng.', 409);
    await assertBranchAccess(transfer, user);
    const details = await StockTransferDetail.find({ transferId: id }).session(session);
    const variants = await ProductVariant.find({ _id: { $in: details.map((row) => row.variantId) } }).select('productId').populate('productId', 'trackingType').session(session).lean();
    const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
    for (const detail of details) {
      const quantity = detail.quantityApproved || 0;
      if (!quantity) continue;
      if (tracking.get(String(detail.variantId)) === 'individual') {
        await InventoryItem.updateMany({ _id: { $in: detail.itemIds }, locationId: transfer.fromLocationId, status: 'reserved' }, { $set: { status: 'available' } }, { session });
      } else {
        const balance = await InventoryBalance.findOne({ locationId: transfer.fromLocationId, storageId: null, variantId: detail.variantId }).session(session);
        if (!balance || balance.quantityReserved < quantity) throw fail('Không thể giải phóng khóa tồn kho; cần kiểm tra số dư chi nhánh.', 409);
        balance.quantityReserved -= quantity; await balance.save({ session });
      }
    }
    transfer.status = 'cancelled'; await transfer.save({ session });
  }); } finally { await session.endSession(); }
  return loadReturn(id, user);
};

export const submitBranchReturnReceipt = async (id, payload, user) => {
  if (!validId(id)) throw fail('Mã phiếu trả hàng không hợp lệ.');
  if (!(isWarehouseStaff(user) || isManager(user))) throw fail('Chỉ nhân viên kho tổng mới ghi nhận hàng trả. ', 403);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const transfer = await StockTransfer.findOne({ _id: id, direction: 'branch_to_central', status: 'shipped' }).session(session);
    if (!transfer) throw fail('Phiếu chưa được gửi từ chi nhánh hoặc đã ghi nhận.', 409);
    if (isWarehouseStaff(user) && String(transfer.assignedStaffId?._id || transfer.assignedStaffId) !== String(user._id)) throw fail('Phiếu này chưa được giao cho bạn.', 403);
    const details = await StockTransferDetail.find({ transferId: id }).session(session);
    const lines = Array.isArray(payload?.items) ? payload.items : [];
    if (lines.some((line) => !isRecord(line) || !validId(line.detailId))) throw fail('Dòng nhận hàng không hợp lệ.');
    const byId = new Map(lines.map((line) => [String(line.detailId), line]));
    if (byId.size !== details.length || details.some((detail) => !byId.has(String(detail._id)))) throw fail('Cần ghi nhận đầy đủ các dòng hàng trong phiếu.');
    const variants = await ProductVariant.find({ _id: { $in: details.map((row) => row.variantId) } }).select('productId').populate('productId', 'trackingType').session(session).lean();
    const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
    for (const detail of details) {
      const line = byId.get(String(detail._id));
      const quantityReceived = integer(line.quantityReceived, 'Số lượng nhận');
      const quantityDamaged = integer(line.quantityDamaged || 0, 'Số lượng hỏng');
      if (quantityReceived > detail.quantityShipped || quantityDamaged > quantityReceived) throw fail('Số lượng nhận hoặc hỏng vượt số lượng đã gửi.');
      if (tracking.get(String(detail.variantId)) === 'individual') {
        const receivedRaw = line.receivedItemIds ?? []; const damagedRaw = line.damagedItemIds ?? [];
        if (!Array.isArray(receivedRaw) || !Array.isArray(damagedRaw)) throw fail('Danh sách InventoryItem nhận/hỏng không hợp lệ.');
        const receivedIds = [...new Set(receivedRaw.map(String))];
        const damagedIds = [...new Set(damagedRaw.map(String))];
        if (receivedIds.length !== receivedRaw.length || damagedIds.length !== damagedRaw.length) throw fail('Danh sách InventoryItem không được trùng.');
        const shippedIds = new Set((detail.itemIds || []).map(String));
        if (receivedIds.length !== quantityReceived || receivedIds.some((itemId) => !shippedIds.has(itemId))) throw fail('Danh sách món nhận không khớp số lượng đã gửi.');
        if (damagedIds.length !== quantityDamaged || damagedIds.some((itemId) => !receivedIds.includes(itemId))) throw fail('Danh sách món hỏng không khớp số lượng nhận.');
        detail.receivedItemIds = receivedIds; detail.damagedItemIds = damagedIds;
      }
      detail.quantityReceived = quantityReceived; detail.quantityDamaged = quantityDamaged;
      detail.quantityMissing = detail.quantityShipped - quantityReceived;
      await detail.save({ session });
    }
    transfer.status = 'receipt_submitted'; transfer.receivedBy = user._id; transfer.receivedAt = new Date();
    transfer.receiptApprovedBy = null; transfer.receiptApprovedAt = null;
    if (payload.note) transfer.note = `${transfer.note || ''}\nGhi nhận nhận hàng: ${String(payload.note).trim()}`.trim();
    await transfer.save({ session });
  }); } finally { await session.endSession(); }
  return loadReturn(id, user);
};

export const decideBranchReturnReceipt = async (id, payload, user) => {
  if (!validId(id)) throw fail('Mã phiếu trả hàng không hợp lệ.');
  if (!isManager(user)) throw fail('Chỉ quản lý kho tổng mới duyệt kết quả nhận hàng.', 403);
  if (!['approve', 'reject'].includes(payload?.decision)) throw fail('Quyết định duyệt không hợp lệ.');
  const transfer = await StockTransfer.findOne({ _id: id, direction: 'branch_to_central', status: 'receipt_submitted' });
  if (!transfer) throw fail('Phiếu chưa có kết quả nhận hàng chờ duyệt.', 409);
  if (payload.decision === 'approve') transfer.status = 'receipt_approved';
  else {
    transfer.status = 'shipped'; transfer.receivedBy = null; transfer.receivedAt = null;
    const details = await StockTransferDetail.find({ transferId: id });
    for (const detail of details) { detail.quantityReceived = 0; detail.quantityDamaged = 0; detail.quantityMissing = 0; detail.receivedItemIds = []; detail.damagedItemIds = []; await detail.save(); }
  }
  transfer.receiptApprovedBy = user._id; transfer.receiptApprovedAt = new Date();
  if (payload.note) transfer.note = `${transfer.note || ''}\n${payload.decision === 'approve' ? 'Duyệt nhận hàng' : 'Yêu cầu kiểm nhận lại'}: ${String(payload.note).trim()}`.trim();
  await transfer.save();
  return loadReturn(id, user);
};

const capacitySnapshot = async (locationId, session, excludeTransferId) => {
  const [location, storages, balances, items] = await Promise.all([
    InventoryLocation.findById(locationId).session(session).lean(),
    StorageLocation.find({ locationId }).session(session).lean(),
    InventoryBalance.find({ locationId }).session(session).lean(),
    InventoryItem.find({ locationId, status: { $nin: ['disposed', 'renting', 'in_transit'] } }).session(session).lean(),
  ]);
  const variantIds = [...new Set([...balances.map((row) => String(row.variantId)), ...items.map((row) => String(row.variantId))])];
  const variants = await ProductVariant.find({ _id: { $in: variantIds } }).select('productId').populate('productId', 'trackingType').session(session).lean();
  const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
  const usedByStorage = new Map(); let used = 0;
  for (const balance of balances) if (tracking.get(String(balance.variantId)) !== 'individual') {
    const quantity = balance.quantityOnHand || 0; used += quantity;
    if (balance.storageId) usedByStorage.set(String(balance.storageId), (usedByStorage.get(String(balance.storageId)) || 0) + quantity);
  }
  for (const item of items) if (tracking.get(String(item.variantId)) === 'individual') {
    used += 1;
    if (item.storageId) usedByStorage.set(String(item.storageId), (usedByStorage.get(String(item.storageId)) || 0) + 1);
  }
  const storageById = new Map(storages.map((row) => [String(row._id), row]));
  const usedWithAncestors = new Map();
  for (const [storageId, quantity] of usedByStorage) {
    let current = storageById.get(storageId); const visited = new Set();
    while (current && !visited.has(String(current._id))) {
      const key = String(current._id); visited.add(key);
      usedWithAncestors.set(key, (usedWithAncestors.get(key) || 0) + quantity);
      current = current.parentStorageId ? storageById.get(String(current.parentStorageId)) : null;
    }
  }
  const openReceipts = await InboundReceipt.find({ locationId, status: { $in: ['awaiting_receiving', 'received', 'approved'] } }).select('_id status').session(session).lean();
  let committed = 0;
  if (openReceipts.length) {
    const byStatus = new Map(openReceipts.map((receipt) => [String(receipt._id), receipt.status]));
    const committedLines = await InboundReceiptDetail.find({ receiptId: { $in: openReceipts.map((receipt) => receipt._id) } }).select('receiptId quantityExpected quantityReceived quantityDamaged').session(session).lean();
    committed = committedLines.reduce((sum, line) => {
      const status = byStatus.get(String(line.receiptId));
      return sum + (status === 'awaiting_receiving' ? line.quantityExpected : Math.max(0, line.quantityReceived - line.quantityDamaged));
    }, 0);
  }
  const openTransfers = await StockTransfer.find({
    direction: 'branch_to_central', toLocationId: locationId,
    _id: { $ne: excludeTransferId },
    status: { $in: ['approved', 'shipped', 'receipt_submitted', 'receipt_approved'] },
  }).select('_id status').session(session).lean();
  if (openTransfers.length) {
    const statusByTransfer = new Map(openTransfers.map((transfer) => [String(transfer._id), transfer.status]));
    const openDetails = await StockTransferDetail.find({ transferId: { $in: openTransfers.map((transfer) => transfer._id) } }).select('transferId quantityApproved quantityShipped quantityReceived quantityDamaged').session(session).lean();
    committed += openDetails.reduce((sum, line) => {
      const status = statusByTransfer.get(String(line.transferId));
      const quantity = status === 'approved' ? line.quantityApproved : status === 'shipped' ? line.quantityShipped : line.quantityReceived;
      return sum + Math.max(0, quantity || 0);
    }, 0);
  }
  return { location, storages, storageById, used, usedWithAncestors, committed };
};

export const putawayBranchReturn = async (id, payload, user) => {
  if (!validId(id)) throw fail('Mã phiếu trả hàng không hợp lệ.');
  if (!(isWarehouseStaff(user) || isManager(user))) throw fail('Bạn không có quyền xếp hàng trả vào kho.', 403);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const transfer = await StockTransfer.findOne({ _id: id, direction: 'branch_to_central', status: 'receipt_approved' }).session(session);
    if (!transfer) throw fail('Kết quả nhận hàng chưa được quản lý kho duyệt.', 409);
    if (isWarehouseStaff(user) && String(transfer.assignedStaffId?._id || transfer.assignedStaffId) !== String(user._id)) throw fail('Phiếu này chưa được giao cho bạn.', 403);
    const details = await StockTransferDetail.find({ transferId: id }).session(session);
    const putawayLines = Array.isArray(payload?.items) ? payload.items : [];
    if (putawayLines.some((line) => !isRecord(line) || !validId(line.detailId))) throw fail('Dòng phân bổ vị trí không hợp lệ.');
    const byId = new Map(putawayLines.map((line) => [String(line.detailId), line]));
    if (byId.size !== details.length || details.some((detail) => !byId.has(String(detail._id)))) throw fail('Cần phân bổ vị trí cho toàn bộ mặt hàng.');
    const snapshot = await capacitySnapshot(transfer.toLocationId, session, transfer._id);
    if (!snapshot.location) throw fail('Không tìm thấy kho tổng.', 404);
    const variants = await ProductVariant.find({ _id: { $in: details.map((row) => row.variantId) } }).select('productId').populate('productId', 'trackingType').session(session).lean();
    const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
    const storageAdds = new Map(); let totalAdded = 0;
    for (const detail of details) {
      const line = byId.get(String(detail._id));
      if (!Array.isArray(line.allocations)) throw fail('Danh sách vị trí xếp hàng không hợp lệ.');
      if (line.allocations.some((allocation) => !isRecord(allocation))) throw fail('Phân bổ kệ không hợp lệ.');
      const accepted = detail.quantityReceived - detail.quantityDamaged;
      const allocated = line.allocations.reduce((sum, row) => sum + integer(row.quantity, 'Số lượng xếp', 1), 0);
      if (allocated !== accepted) throw fail(`Số lượng phân bổ cho ${detail.variantId} phải bằng số lượng hàng đạt (${accepted}).`);
      const individual = tracking.get(String(detail.variantId)) === 'individual';
      const assignedItems = [];
      for (const allocation of line.allocations) {
        if (!validId(allocation.storageId)) throw fail('Chọn kệ hợp lệ trong kho tổng.');
        const rawItemIds = allocation.itemIds ?? [];
        if (!Array.isArray(rawItemIds)) throw fail('Danh sách InventoryItem theo kệ không hợp lệ.');
        const storage = snapshot.storageById.get(String(allocation.storageId));
        if (!storage || storage.type !== 'shelf' || storage.status !== 'active') throw fail('Vị trí xếp phải là kệ đang hoạt động thuộc kho tổng.');
        if (individual) {
          const ids = [...new Set(rawItemIds.map(String))];
          if (ids.length !== rawItemIds.length) throw fail('InventoryItem không được phân bổ trùng kệ.');
          if (ids.length !== allocation.quantity || ids.some((itemId) => !detail.receivedItemIds.map(String).includes(itemId) || detail.damagedItemIds.map(String).includes(itemId))) throw fail('Chọn đúng số món đạt chất lượng cho từng kệ.');
          assignedItems.push(...ids);
        } else if (rawItemIds.length) throw fail('Mặt hàng quản lý theo số lượng không dùng danh sách InventoryItem.');
        const key = String(storage._id); storageAdds.set(key, (storageAdds.get(key) || 0) + allocation.quantity);
        let parent = storage;
        while (parent) {
          const parentKey = String(parent._id);
          storageAdds.set(parentKey, storageAdds.get(parentKey) || 0);
          if (parent.parentStorageId) {
            const ancestor = snapshot.storageById.get(String(parent.parentStorageId));
            if (ancestor) storageAdds.set(String(ancestor._id), (storageAdds.get(String(ancestor._id)) || 0) + allocation.quantity);
            parent = ancestor;
          } else parent = null;
        }
      }
      if (individual && (new Set(assignedItems).size !== assignedItems.length || assignedItems.length !== accepted)) throw fail('Mỗi món đạt chất lượng cần được gán đúng một kệ.');
      detail.putawayAllocations = line.allocations.map((row) => ({ storageId: row.storageId, quantity: Number(row.quantity), itemIds: row.itemIds || [] }));
      totalAdded += detail.quantityReceived;
    }
    for (const [storageId, added] of storageAdds) {
      const storage = snapshot.storageById.get(storageId);
      if (storage?.maxCapacity != null && (snapshot.usedWithAncestors.get(storageId) || 0) + added > storage.maxCapacity) throw fail(`Không đủ sức chứa tại ${storage.code}.`, 409);
    }
    if (snapshot.location.maxCapacity != null && snapshot.used + snapshot.committed + totalAdded > snapshot.location.maxCapacity) throw fail('Kho tổng không đủ sức chứa cho hàng trả về và các phiếu nhập đang mở.', 409);

    for (const detail of details) {
      const line = byId.get(String(detail._id));
      const individual = tracking.get(String(detail.variantId)) === 'individual';
      if (individual) {
        const allocationByItem = new Map(line.allocations.flatMap((row) => (row.itemIds || []).map((itemId) => [String(itemId), row.storageId])));
        const received = new Set(detail.receivedItemIds.map(String)); const damaged = new Set(detail.damagedItemIds.map(String));
        for (const itemId of received) {
          const item = await InventoryItem.findOne({ _id: itemId, status: 'in_transit', locationId: transfer.fromLocationId }).session(session);
          if (!item) throw fail('Một món hàng không còn ở trạng thái đang điều chuyển.', 409);
          item.locationId = transfer.toLocationId;
          if (damaged.has(itemId)) { item.storageId = null; item.status = 'unavailable'; item.condition = 'damaged'; }
          else { item.storageId = allocationByItem.get(itemId); item.status = 'available'; }
          await item.save({ session });
          await recordStockMovement({ variantId: detail.variantId, itemId: item._id, locationId: transfer.toLocationId, storageId: item.storageId, movementType: 'transfer_in', quantityChange: 1, referenceType: 'stock_transfer', referenceId: transfer._id, createdBy: user._id }, session);
        }
        const missing = detail.itemIds.map(String).filter((itemId) => !received.has(itemId));
        if (missing.length) await InventoryItem.updateMany({ _id: { $in: missing }, status: 'in_transit' }, { $set: { status: 'disposed', condition: 'missing' } }, { session });
      } else {
        for (const allocation of line.allocations) {
          await InventoryBalance.findOneAndUpdate(
            { locationId: transfer.toLocationId, storageId: allocation.storageId, variantId: detail.variantId },
            { $inc: { quantityOnHand: allocation.quantity } }, { upsert: true, new: true, session, setDefaultsOnInsert: true, runValidators: true },
          );
          await recordStockMovement({ variantId: detail.variantId, locationId: transfer.toLocationId, storageId: allocation.storageId, movementType: 'transfer_in', quantityChange: allocation.quantity, referenceType: 'stock_transfer', referenceId: transfer._id, createdBy: user._id }, session);
        }
        if (detail.quantityDamaged > 0) {
          await InventoryBalance.findOneAndUpdate(
            { locationId: transfer.toLocationId, storageId: null, variantId: detail.variantId },
            { $inc: { quantityOnHand: detail.quantityDamaged, quantityUnavailable: detail.quantityDamaged } }, { upsert: true, new: true, session, setDefaultsOnInsert: true, runValidators: true },
          );
          await recordStockMovement({ variantId: detail.variantId, locationId: transfer.toLocationId, movementType: 'transfer_in', quantityChange: detail.quantityDamaged, referenceType: 'stock_transfer', referenceId: transfer._id, createdBy: user._id }, session);
        }
      }
      await detail.save({ session });
    }
    transfer.status = 'completed'; transfer.putawayBy = user._id; transfer.putawayAt = new Date(); await transfer.save({ session });
  }); } finally { await session.endSession(); }
  return loadReturn(id, user);
};
