import mongoose from 'mongoose';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../models/shop/Shop.js';
import { StockDiscrepancy } from '../../models/warehouse/transfer/StockDiscrepancy.js';
import { discrepancyStatuses, validateResolveDiscrepancy } from '../../validations/warehouse/stockDiscrepancyValidation.js';
import { increaseInventoryBalance, recordStockMovement } from './inventoryLedgerService.js';
import { assertBranchCapacity } from './stockTransferService.js';
import { capacitySnapshot } from './branchReturnService.js';
import { moveItem, moveItems } from './itemStateService.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const roleOf = (user) => String(user?.Role || user?.role || '').trim().toLowerCase().replace(/[\s_-]/g, '').replace('brandmanager', 'branchmanager');
const isManager = (user) => ['warehousemanager', 'admin'].includes(roleOf(user));
const isBranchManager = (user) => roleOf(user) === 'branchmanager';
const validId = (id) => mongoose.isValidObjectId(id);
const idOf = (value) => String(value?._id || value || '');
const makeCode = () => `CL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
const unresolvedStatuses = ['open', 'partially_resolved'];

const population = [
  { path: 'transferId', select: 'transferCode direction status' },
  { path: 'fromLocationId', select: 'code name type' },
  { path: 'toLocationId', select: 'code name type' },
  { path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'productCode name trackingType' } },
  { path: 'itemIds', select: 'itemCode serialNumber condition status locationId storageId' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'resolutions.resolvedBy', select: 'FullName Email' },
  { path: 'resolutions.targetLocationId', select: 'code name type' },
  { path: 'resolutions.targetStorageId', select: 'code name type' },
  { path: 'resolutions.itemIds', select: 'itemCode serialNumber' },
];

/**
 * Mở phiếu chênh lệch cho các dòng điều chuyển bị thiếu. Gọi trong transaction của bước chốt nhận hàng.
 * - Hàng individual: món thiếu giữ `in_transit`, đặt `condition: 'missing'`, lưu condition cũ để khôi phục khi tìm thấy.
 * - Hàng quantity: chỉ ghi số thiếu (số này đã ra khỏi sổ ở bước xuất).
 * Không ghi StockMovement: lúc xuất đã ghi transfer_out đủ số lượng.
 */
export const openTransferDiscrepancies = async ({ transfer, details, tracking, user, session }) => {
  const created = [];
  for (const detail of details) {
    const missing = Number(detail.quantityMissing || 0);
    if (missing <= 0 || detail.discrepancyId) continue;
    const individual = tracking.get(String(detail.variantId)) === 'individual';
    let itemIds = [];
    let itemPreviousConditions = [];
    if (individual) {
      const received = new Set((detail.receivedItemIds || []).map(String));
      const missingIds = (detail.itemIds || []).map(String).filter((id) => !received.has(id));
      const items = await InventoryItem.find({ _id: { $in: missingIds }, status: 'in_transit' }).select('_id itemCode variantId locationId storageId status condition').session(session).lean();
      if (items.length !== missing) throw fail('Số món thiếu không khớp với danh sách mã hàng đang điều chuyển.', 409);
      itemIds = items.map((item) => item._id);
      itemPreviousConditions = items.map((item) => ({ itemId: item._id, condition: item.condition || 'good' }));
      // Món vẫn in_transit (không nằm trong balance), chỉ đổi tình trạng; đi qua itemStateService cho thống nhất.
      await moveItems(items, { condition: 'missing' }, session);
    }
    const [discrepancy] = await StockDiscrepancy.create([{
      discrepancyCode: makeCode(),
      transferId: transfer._id,
      transferDetailId: detail._id,
      direction: transfer.direction || 'central_to_branch',
      fromLocationId: transfer.fromLocationId,
      toLocationId: transfer.toLocationId,
      variantId: detail.variantId,
      trackingType: individual ? 'individual' : 'quantity',
      quantityMissing: missing,
      itemIds,
      itemPreviousConditions,
      status: 'open',
      createdBy: user._id,
    }], { session });
    detail.discrepancyId = discrepancy._id;
    await detail.save({ session });
    created.push(discrepancy);
  }
  return created;
};

const branchLocationIds = async (user) => {
  const shopIds = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).distinct('_id');
  if (!shopIds.length) return [];
  return InventoryLocation.find({ shopId: { $in: shopIds }, type: 'store' }).distinct('_id');
};

const assertCanView = async (discrepancy, user) => {
  if (isManager(user)) return;
  if (!isBranchManager(user)) throw fail('Bạn không có quyền xem phiếu chênh lệch.', 403);
  const allowed = new Set((await branchLocationIds(user)).map(String));
  if (!allowed.has(idOf(discrepancy.fromLocationId)) && !allowed.has(idOf(discrepancy.toLocationId))) throw fail('Phiếu chênh lệch không liên quan tới chi nhánh bạn quản lý.', 403);
};

export const listDiscrepancies = async (user, { status = '' } = {}) => {
  const filter = {};
  if (status === 'pending') filter.status = { $in: unresolvedStatuses };
  else if (status && discrepancyStatuses.includes(status)) filter.status = status;
  if (!isManager(user)) {
    if (!isBranchManager(user)) throw fail('Bạn không có quyền xem phiếu chênh lệch.', 403);
    const locationIds = await branchLocationIds(user);
    filter.$or = [{ fromLocationId: { $in: locationIds } }, { toLocationId: { $in: locationIds } }];
  }
  return StockDiscrepancy.find(filter).sort({ createdAt: -1 }).populate(population).lean();
};

export const getDiscrepancy = async (id, user) => {
  if (!validId(id)) throw fail('Mã phiếu chênh lệch không hợp lệ.');
  const discrepancy = await StockDiscrepancy.findById(id).populate(population).lean();
  if (!discrepancy) throw fail('Không tìm thấy phiếu chênh lệch.', 404);
  await assertCanView(discrepancy, user);
  return discrepancy;
};

const resolveTarget = async (discrepancy, data, session) => {
  const target = await InventoryLocation.findOne({ _id: data.targetLocationId, status: 'active' }).session(session).lean();
  if (!target) throw fail('Nơi nhập lại không tồn tại hoặc đã ngừng hoạt động.');
  if (target.type === 'warehouse') {
    const centrals = await InventoryLocation.find({ type: 'warehouse', status: 'active' }).select('_id').session(session).lean();
    if (centrals.length !== 1 || String(centrals[0]._id) !== String(target._id)) throw fail('Hệ thống cần đúng một kho tổng đang hoạt động để nhập lại hàng.', 409);
    if (!validId(data.targetStorageId)) throw fail('Nhập lại vào kho tổng phải chọn kệ.');
    return { location: target, central: true };
  }
  if (String(target._id) !== idOf(discrepancy.toLocationId)) throw fail('Chỉ nhập lại vào nơi nhận ban đầu hoặc kho tổng.');
  if (data.targetStorageId) throw fail('Nhập lại về chi nhánh không chọn kệ.');
  return { location: target, central: false };
};

const assertCentralShelfCapacity = async (location, storageId, quantity, session) => {
  const snapshot = await capacitySnapshot(location._id, session, null);
  const storage = snapshot.storageById.get(String(storageId));
  if (!storage || storage.type !== 'shelf' || storage.status !== 'active') throw fail('Vị trí nhập lại phải là kệ đang hoạt động thuộc kho tổng.');
  let cursor = storage;
  const visited = new Set();
  while (cursor && !visited.has(String(cursor._id))) {
    const key = String(cursor._id);
    visited.add(key);
    if (cursor.maxCapacity != null && (snapshot.usedWithAncestors.get(key) || 0) + quantity > cursor.maxCapacity) throw fail(`Không đủ sức chứa tại ${cursor.code}.`, 409);
    cursor = cursor.parentStorageId ? snapshot.storageById.get(String(cursor.parentStorageId)) : null;
  }
  if (snapshot.location?.maxCapacity != null && snapshot.used + snapshot.committed + quantity > snapshot.location.maxCapacity) throw fail('Kho tổng không đủ sức chứa cho hàng tìm thấy và các phiếu nhập đang mở.', 409);
};

export const resolveDiscrepancy = async (id, payload, user) => {
  if (!isManager(user)) throw fail('Chỉ quản lý kho tổng mới được kết luận phiếu chênh lệch.', 403);
  if (!validId(id)) throw fail('Mã phiếu chênh lệch không hợp lệ.');
  const data = validateResolveDiscrepancy(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const discrepancy = await StockDiscrepancy.findOne({ _id: id, status: { $in: unresolvedStatuses } }).session(session);
      if (!discrepancy) {
        if (!await StockDiscrepancy.exists({ _id: id }).session(session)) throw fail('Không tìm thấy phiếu chênh lệch.', 404);
        throw fail('Phiếu chênh lệch đã được kết luận xong.', 409);
      }
      const individual = discrepancy.trackingType === 'individual';
      const remaining = discrepancy.quantityMissing - discrepancy.quantityResolved;
      let itemIds = [];
      let quantity;
      if (individual) {
        if (!data.itemIds.length) throw fail('Chọn các món hàng cần kết luận.');
        const resolvedIds = new Set(discrepancy.resolutions.flatMap((row) => row.itemIds.map(String)));
        const allowed = new Set(discrepancy.itemIds.map(String));
        if (data.itemIds.some((itemId) => !allowed.has(itemId) || resolvedIds.has(itemId))) throw fail('Có món hàng không thuộc phiếu chênh lệch hoặc đã được kết luận.', 409);
        itemIds = data.itemIds;
        quantity = itemIds.length;
        if (data.quantity != null && data.quantity !== quantity) throw fail('Số lượng phải bằng số món đã chọn.');
      } else {
        if (data.itemIds.length) throw fail('Mặt hàng quản lý theo số lượng không chọn mã cá thể.');
        if (data.quantity == null) throw fail('Nhập số lượng cần kết luận.');
        quantity = data.quantity;
      }
      if (quantity > remaining) throw fail(`Số lượng kết luận vượt số còn đang điều tra (${remaining}).`, 409);

      // Giành phiếu bằng cập nhật có điều kiện trên quantityResolved để hai lần kết luận đồng thời không cùng thành công.
      const resolvedAt = new Date();
      const nextResolved = discrepancy.quantityResolved + quantity;
      const claimed = await StockDiscrepancy.findOneAndUpdate(
        { _id: discrepancy._id, status: { $in: unresolvedStatuses }, quantityResolved: discrepancy.quantityResolved },
        {
          $set: { quantityResolved: nextResolved, status: nextResolved >= discrepancy.quantityMissing ? 'resolved' : 'partially_resolved' },
          $push: { resolutions: {
            outcome: data.outcome, quantity, itemIds,
            targetLocationId: data.targetLocationId || null, targetStorageId: data.targetStorageId || null,
            responsibleParty: data.responsibleParty || null, note: data.note || '',
            resolvedBy: user._id, resolvedAt,
          } },
        },
        { new: true, session },
      );
      if (!claimed) throw fail('Phiếu chênh lệch vừa được người khác cập nhật. Hãy tải lại phiếu.', 409);

      if (data.outcome === 'lost') {
        // Mất: không ghi StockMovement vì số lượng đã ra khỏi sổ lúc xuất.
        if (individual) {
          // TASK-009: in_transit → disposed qua itemStateService. Món đang in_transit nên balance không đổi.
          const items = await InventoryItem.find({ _id: { $in: itemIds }, status: 'in_transit' }).session(session);
          if (items.length !== itemIds.length) throw fail('Một số món hàng không còn ở trạng thái đang điều tra.', 409);
          await moveItems(items, { status: 'disposed', condition: 'missing' }, session);
        }
        return;
      }

      const { location, central } = await resolveTarget(discrepancy, data, session);
      const storageId = central ? data.targetStorageId : null;
      if (central) await assertCentralShelfCapacity(location, storageId, quantity, session);
      else await assertBranchCapacity(location, [{ variantId: discrepancy.variantId, quantity }], session);

      const movementBase = {
        variantId: discrepancy.variantId, locationId: location._id, storageId,
        movementType: 'transfer_in', referenceType: 'stock_discrepancy', referenceId: discrepancy._id, createdBy: user._id,
      };
      if (individual) {
        // TASK-009: món tìm thấy in_transit → available/unavailable tại nơi nhập lại; balance cộng qua itemStateService.
        const previous = new Map(discrepancy.itemPreviousConditions.map((row) => [String(row.itemId), row.condition]));
        for (const itemId of itemIds) {
          const condition = previous.get(itemId) || 'good';
          const item = await InventoryItem.findOne({ _id: itemId, status: 'in_transit' }).session(session);
          if (!item) throw fail('Một số món hàng không còn ở trạng thái đang điều tra.', 409);
          await moveItem(item, {
            status: ['damaged', 'unrepairable'].includes(condition) ? 'unavailable' : 'available',
            condition, locationId: location._id, storageId,
          }, session);
          await recordStockMovement({ ...movementBase, itemId: item._id, quantityChange: 1 }, session);
        }
      } else {
        await increaseInventoryBalance({ locationId: location._id, storageId, variantId: discrepancy.variantId, quantity, session });
        await recordStockMovement({ ...movementBase, quantityChange: quantity }, session);
      }
    });
  } finally { await session.endSession(); }
  return getDiscrepancy(id, user);
};
