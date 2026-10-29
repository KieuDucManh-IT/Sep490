import mongoose from 'mongoose';
import { InboundReceipt } from '../../models/warehouse/inbound/InboundReceipt.js';
import { InboundReceiptDetail } from '../../models/warehouse/inbound/InboundReceiptDetail.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Supplier } from '../../models/masterdata/Supplier.js';
import User from '../../models/system/User.js';
import { validateCreateInboundReceipt, validatePutaway, validateReceiptCheck } from '../../validations/warehouse/inboundReceiptValidation.js';

const openStatuses = ['awaiting_receiving', 'received', 'approved'];
const receiptStatuses = [...openStatuses, 'completed', 'rejected', 'cancelled'];
const fail = (message, statusCode = 400, code) => Object.assign(new Error(message), { statusCode, code });
const capacityOf = (value) => Number.isInteger(value) && value > 0 ? value : 0;
const sum = (rows, field) => rows.reduce((total, row) => total + (row[field] || 0), 0);

const receiptPopulation = [
  { path: 'locationId', select: 'code name maxCapacity' },
  { path: 'supplierId', select: 'supplierCode name' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'assignedStaffId', select: 'FullName Email' },
  { path: 'receivedBy', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
  { path: 'putawayBy', select: 'FullName Email' },
];

const loadDetails = async (receiptId) => InboundReceiptDetail.find({ receiptId }).sort({ createdAt: 1 })
  .populate({ path: 'variantId', select: 'sku variantName size color productId', populate: { path: 'productId', select: 'name productCode trackingType' } })
  .populate('storageAllocations.storageId', 'code name type')
  .populate('storageId', 'code name type');

const getPhysicalCapacity = async (locationId) => {
  const location = await InventoryLocation.findById(locationId).lean();
  if (!location) throw fail('Không tìm thấy kho/cửa hàng.', 404);
  const storageLocations = await StorageLocation.find({ locationId }).select('_id parentStorageId maxCapacity type status').lean();
  const storageById = new Map(storageLocations.map((storage) => [String(storage._id), storage]));
  const balanceRows = await InventoryBalance.aggregate([
    { $match: { locationId: new mongoose.Types.ObjectId(locationId) } },
    { $group: { _id: { storageId: '$storageId', variantId: '$variantId' }, quantity: { $sum: '$quantityOnHand' } } },
  ]);
  const itemRows = await InventoryItem.aggregate([
    { $match: { locationId: new mongoose.Types.ObjectId(locationId), status: { $nin: ['disposed', 'renting'] } } },
    { $group: { _id: { storageId: '$storageId', variantId: '$variantId' }, quantity: { $sum: 1 } } },
  ]);
  const variantIds = [...new Set([...balanceRows, ...itemRows].map((row) => String(row._id.variantId)))];
  const variants = await ProductVariant.find({ _id: { $in: variantIds } }).select('productId').populate('productId', 'trackingType').lean();
  const trackingByVariant = new Map(variants.map((variant) => [String(variant._id), variant.productId?.trackingType || 'quantity']));
  const directByStorage = new Map();
  const addDirect = (storageId, quantity) => {
    const key = storageId ? String(storageId) : '';
    directByStorage.set(key, (directByStorage.get(key) || 0) + quantity);
  };
  for (const row of balanceRows) if (trackingByVariant.get(String(row._id.variantId)) !== 'individual') addDirect(row._id.storageId, row.quantity);
  for (const row of itemRows) if (trackingByVariant.get(String(row._id.variantId)) === 'individual') addDirect(row._id.storageId, row.quantity);

  const usedByStorage = new Map();
  for (const [storageId, quantity] of directByStorage.entries()) {
    if (!storageId) continue;
    let cursor = storageById.get(storageId);
    const visited = new Set();
    while (cursor && !visited.has(String(cursor._id))) {
      const cursorId = String(cursor._id);
      visited.add(cursorId);
      usedByStorage.set(cursorId, (usedByStorage.get(cursorId) || 0) + quantity);
      cursor = cursor.parentStorageId ? storageById.get(String(cursor.parentStorageId)) : null;
    }
  }
  const used = [...directByStorage.values()].reduce((total, value) => total + value, 0);
  return { location, storageLocations, storageById, usedByStorage, used };
};

const getOpenCommitment = async (locationId, excludeReceiptId = null) => {
  const query = { locationId, status: { $in: openStatuses } };
  if (excludeReceiptId) query._id = { $ne: excludeReceiptId };
  const receipts = await InboundReceipt.find(query).select('_id status').lean();
  if (!receipts.length) return 0;
  const ids = receipts.map((receipt) => receipt._id);
  const details = await InboundReceiptDetail.aggregate([
    { $match: { receiptId: { $in: ids } } },
    { $group: { _id: '$receiptId', expected: { $sum: '$quantityExpected' }, accepted: { $sum: { $cond: [{ $gt: [{ $subtract: ['$quantityReceived', '$quantityDamaged'] }, 0] }, { $subtract: ['$quantityReceived', '$quantityDamaged'] }, 0] } } } },
  ]);
  const receiptById = new Map(receipts.map((receipt) => [String(receipt._id), receipt]));
  return details.reduce((total, detail) => {
    const receipt = receiptById.get(String(detail._id));
    return total + (receipt.status === 'awaiting_receiving' ? detail.expected : detail.accepted);
  }, 0);
};

export const listWarehouseStaff = async () => User.find({ Role: /^warehouse_staff$/i, Status: /^active$/i })
  .select('FullName Email').sort({ FullName: 1 }).lean();

export const listInboundReceipts = async ({ status, staffId } = {}) => {
  const filter = { receiptType: 'supplier' };
  if (status && receiptStatuses.includes(status)) filter.status = status;
  if (staffId) filter.assignedStaffId = staffId;
  const receipts = await InboundReceipt.find(filter).sort({ createdAt: -1 }).populate(receiptPopulation);
  return Promise.all(receipts.map(async (receipt) => ({ ...receipt.toObject(), items: await loadDetails(receipt._id) })));
};

export const getInboundReceipt = async (receiptId, requester = null) => {
  const receipt = await InboundReceipt.findOne({ _id: receiptId, receiptType: 'supplier' }).populate(receiptPopulation);
  if (!receipt) throw fail('Không tìm thấy phiếu nhập.', 404);
  if (requester?.Role?.toLowerCase() === 'warehouse_staff' && String(receipt.assignedStaffId?._id || receipt.assignedStaffId) !== String(requester._id)) {
    throw fail('Phiếu này chưa được giao cho bạn.', 403);
  }
  return { ...receipt.toObject(), items: await loadDetails(receipt._id) };
};

export const createInboundReceipt = async (payload, userId) => {
  const data = validateCreateInboundReceipt(payload);
  const [location, supplier, staff, variants] = await Promise.all([
    InventoryLocation.findById(data.locationId),
    Supplier.findOne({ _id: data.supplierId, status: 'active' }),
    User.findOne({ _id: data.assignedStaffId, Role: /^warehouse_staff$/i, Status: /^active$/i }),
    ProductVariant.find({ _id: { $in: data.items.map((item) => item.variantId) }, status: 'active' }).populate('productId', 'status'),
  ]);
  if (!location || location.status !== 'active') throw fail('Kho/cửa hàng không tồn tại hoặc đang ngừng hoạt động.', 400);
  if (!supplier) throw fail('Nhà cung cấp không tồn tại hoặc đang ngừng hoạt động.', 400);
  if (!staff) throw fail('Nhân viên được giao không tồn tại, không phải nhân viên kho hoặc đã ngừng hoạt động.', 400);
  if (variants.length !== new Set(data.items.map((item) => item.variantId)).size || variants.some((variant) => !variant.productId || variant.productId.status !== 'active')) throw fail('Một hoặc nhiều biến thể không tồn tại hoặc đang ngừng kinh doanh.', 400);

  const code = 'PN-' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '-' + new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase();
  const receipt = await InboundReceipt.create({
    receiptCode: code,
    locationId: data.locationId,
    supplierId: data.supplierId,
    receiptType: 'supplier',
    status: 'awaiting_receiving',
    createdBy: userId,
    assignedStaffId: data.assignedStaffId,
    note: data.note,
  });
  try {
    await InboundReceiptDetail.insertMany(data.items.map((item) => ({ receiptId: receipt._id, ...item })));
  } catch (error) {
    await InboundReceipt.findByIdAndDelete(receipt._id);
    throw error;
  }
  return getInboundReceipt(receipt._id);
};

export const recordReceipt = async (receiptId, payload, user) => {
  const receipt = await InboundReceipt.findOne({ _id: receiptId, receiptType: 'supplier' });
  if (!receipt || receipt.status !== 'awaiting_receiving') throw fail('Phiếu không ở trạng thái chờ ghi nhận hàng.', 409);
  if (String(receipt.assignedStaffId) !== String(user._id)) throw fail('Phiếu này chưa được giao cho bạn.', 403);
  const details = await InboundReceiptDetail.find({ receiptId }).select('_id');
  const changes = validateReceiptCheck(payload, details.map((item) => String(item._id)));
  await Promise.all(changes.map((item) => InboundReceiptDetail.findOneAndUpdate(
    { _id: item.detailId, receiptId },
    { $set: { quantityReceived: item.quantityReceived, quantityDamaged: item.quantityDamaged, note: item.note } },
    { runValidators: true }
  )));
  receipt.status = 'received';
  receipt.receivedBy = user._id;
  receipt.receivedAt = new Date();
  await receipt.save();
  return getInboundReceipt(receiptId);
};

export const approveReceipt = async (receiptId, userId, decision, note = '') => {
  const receipt = await InboundReceipt.findOne({ _id: receiptId, receiptType: 'supplier' });
  if (!receipt || receipt.status !== 'received') throw fail('Chỉ có thể duyệt hoặc từ chối phiếu đã được nhân viên ghi nhận.', 409);
  if (decision === 'reject') {
    receipt.status = 'rejected';
    receipt.note = note ? `${receipt.note}\nTừ chối: ${note}`.trim() : receipt.note;
  } else {
    receipt.status = 'approved';
    receipt.approvedAt = new Date();
  }
  receipt.approvedBy = userId;
  await receipt.save();
  return getInboundReceipt(receiptId);
};

export const putawayReceipt = async (receiptId, payload, user) => {
  const receipt = await InboundReceipt.findOne({ _id: receiptId, receiptType: 'supplier' });
  if (!receipt || receipt.status !== 'approved') throw fail('Chỉ có thể sắp xếp kho cho phiếu đã được duyệt.', 409);
  if (String(receipt.assignedStaffId) !== String(user._id)) throw fail('Phiếu này chưa được giao cho bạn.', 403);
  const details = await InboundReceiptDetail.find({ receiptId });
  const allocations = validatePutaway(payload, details.map((item) => String(item._id)));
  const allocationByDetail = new Map(allocations.map((item) => [item.detailId, item.allocations]));
  const acceptedLines = details.map((detail) => ({ detail, quantity: Math.max(0, detail.quantityReceived - detail.quantityDamaged), allocations: allocationByDetail.get(String(detail._id)) || [] }));
  for (const line of acceptedLines) {
    if (sum(line.allocations, 'quantity') !== line.quantity) throw fail(`Tổng số lượng phân bổ cho ${line.detail.variantId} phải bằng số lượng hàng đạt chất lượng (${line.quantity}).`, 400);
  }
  const toStore = acceptedLines.flatMap((line) => line.allocations.map((allocation) => ({ detail: line.detail, ...allocation })));
  const snapshot = await getPhysicalCapacity(receipt.locationId);
  const shelves = await StorageLocation.find({ _id: { $in: toStore.map((line) => line.storageId) }, type: 'shelf', status: 'active', locationId: receipt.locationId }).lean();
  if (shelves.length !== new Set(toStore.map((line) => line.storageId)).size) throw fail('Một hoặc nhiều shelf không hợp lệ, ngừng hoạt động hoặc thuộc kho khác.', 400);

  const addedByAncestor = new Map();
  for (const line of toStore) {
    const storageId = String(line.storageId);
    let cursor = snapshot.storageById.get(storageId);
    const visited = new Set();
    while (cursor && !visited.has(String(cursor._id))) {
      const id = String(cursor._id);
      visited.add(id);
      addedByAncestor.set(id, (addedByAncestor.get(id) || 0) + line.quantity);
      cursor = cursor.parentStorageId ? snapshot.storageById.get(String(cursor.parentStorageId)) : null;
    }
  }
  for (const storage of snapshot.storageLocations) {
    const id = String(storage._id);
    if (!addedByAncestor.has(id)) continue;
    const projected = (snapshot.usedByStorage.get(id) || 0) + (addedByAncestor.get(id) || 0);
    if (projected > capacityOf(storage.maxCapacity)) throw fail(`Không đủ sức chứa tại ${storage.code}: còn ${Math.max(0, capacityOf(storage.maxCapacity) - (snapshot.usedByStorage.get(id) || 0))} cái.`, 409);
  }
  const otherCommitted = await getOpenCommitment(receipt.locationId, receipt._id);
  const locationProjected = snapshot.used + otherCommitted + sum(toStore, 'quantity');
  if (locationProjected > capacityOf(snapshot.location.maxCapacity)) throw fail(`Không đủ sức chứa toàn kho: còn ${Math.max(0, capacityOf(snapshot.location.maxCapacity) - snapshot.used - otherCommitted)} cái.`, 409);

  const variantTracking = await ProductVariant.find({ _id: { $in: toStore.map((line) => line.detail.variantId) } })
    .select('productId').populate('productId', 'trackingType').lean();
  const trackingByVariant = new Map(variantTracking.map((variant) => [String(variant._id), variant.productId?.trackingType || 'quantity']));
  for (const line of toStore) {
    await InventoryBalance.findOneAndUpdate(
      { locationId: receipt.locationId, storageId: line.storageId, variantId: line.detail.variantId },
      { $inc: { quantityOnHand: line.quantity } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    if (trackingByVariant.get(String(line.detail.variantId)) === 'individual') {
      const items = Array.from({ length: line.quantity }, () => ({
        variantId: line.detail.variantId,
        locationId: receipt.locationId,
        storageId: line.storageId,
        itemCode: `ITM-${new mongoose.Types.ObjectId().toString().toUpperCase()}`,
        condition: 'new',
        status: 'available',
      }));
      await InventoryItem.insertMany(items);
    }
    await StockMovement.create({
      variantId: line.detail.variantId,
      locationId: receipt.locationId,
      storageId: line.storageId,
      movementType: 'inbound',
      quantityChange: line.quantity,
      referenceType: 'inbound_receipt',
      referenceId: receipt._id,
      createdBy: user._id,
    });
  }
  await Promise.all(acceptedLines.map(({ detail, allocations: lineAllocations }) => InboundReceiptDetail.findByIdAndUpdate(detail._id, {
    $set: {
      storageId: lineAllocations.length === 1 ? lineAllocations[0].storageId : null,
      storageAllocations: lineAllocations,
    },
  })));
  receipt.status = 'completed';
  receipt.putawayBy = user._id;
  receipt.putawayAt = new Date();
  await receipt.save();
  return getInboundReceipt(receiptId);
};
