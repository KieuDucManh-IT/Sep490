// TASK-009 — Helper DUY NHẤT để đổi trạng thái / location / kệ của InventoryItem (hàng `individual`).
// Mọi thay đổi đi kèm cập nhật InventoryBalance trong CÙNG transaction (bắt buộc truyền `session`).
// Quy tắc quy đổi nằm ở itemBalanceRules.js (hàm thuần, có unit test).
import { InventoryItem as InventoryItemModel } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryBalance as InventoryBalanceModel } from '../../models/warehouse/inventory/InventoryBalance.js';
import { StockMovement as StockMovementModel } from '../../models/warehouse/inventory/StockMovement.js';
import {
  assertBalanceInvariant, bucketOf, computeBalanceDeltas, idOf, mergeBalanceDeltas,
} from './itemBalanceRules.js';

import { appError as fail } from './shared/errors.js';
export {
  bucketOf, computeBalanceDeltas, mergeBalanceDeltas, checkBalanceInvariant, assertBalanceInvariant,
  applyBalanceDeltas, balanceKey, ON_HAND_STATUSES, UNAVAILABLE_STATUSES, OFF_HAND_STATUSES,
} from './itemBalanceRules.js';

const STATE_FIELDS = ['status', 'locationId', 'storageId'];

const stateOf = (item) => ({
  locationId: item.locationId?._id ?? item.locationId,
  storageId: item.storageId?._id ?? item.storageId ?? null,
  variantId: item.variantId?._id ?? item.variantId,
  status: item.status,
});

const sameId = (a, b) => idOf(a) === idOf(b);

/**
 * Tạo service với model truyền vào (để test được bằng model giả). Bản mặc định ở cuối file dùng model thật.
 * `hasRentingColumn`: true khi InventoryBalance có cột `quantityRenting` (TASK-010). Mặc định tự dò từ schema,
 * nên TASK-010 chỉ cần thêm cột vào model là helper bắt đầu ghi `quantityRenting`.
 */
export const createItemStateService = ({ InventoryItem, InventoryBalance, hasRentingColumn } = {}) => {
  const rentingEnabled = () => (typeof hasRentingColumn === 'function'
    ? hasRentingColumn()
    : hasRentingColumn ?? Boolean(InventoryBalance?.schema?.path?.('quantityRenting')));

  const requireSession = (session) => {
    if (!session) throw new Error('itemStateService phải chạy trong transaction: thiếu session.');
  };

  /** $inc từng dòng balance (upsert) rồi kiểm tra invariant sau ghi. Lỗi → 409, transaction rollback. */
  const applyDeltas = async (deltas, session) => {
    requireSession(session);
    const renting = rentingEnabled();
    const rows = [];
    for (const delta of deltas) {
      const inc = { ...delta.inc };
      if (!renting) delete inc.quantityRenting;
      if (!Object.keys(inc).length) continue;
      const row = await InventoryBalance.findOneAndUpdate(
        { locationId: delta.locationId, storageId: delta.storageId ?? null, variantId: delta.variantId },
        { $inc: inc },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true, session },
      );
      const plain = typeof row?.toObject === 'function' ? row.toObject() : row;
      assertBalanceInvariant(plain, 'Tồn kho của biến thể');
      rows.push(plain);
    }
    return rows;
  };

  /**
   * Đổi trạng thái / location / kệ / tình trạng của nhiều món, gộp phần chênh theo dòng balance ($inc một lần mỗi dòng).
   * - items: document (mongoose hoặc lean) đã đọc trong cùng session, cần có _id, variantId, locationId, storageId, status.
   * - changes: object hoặc hàm (item) => object: { status?, condition?, locationId?, storageId?, warehouseHold? }
   *     warehouseHold +1: phiếu kho (tách/gộp kệ, trả hàng chi nhánh) bắt đầu giữ món → reserved +1 ở dòng mới.
   *     warehouseHold -1: phiếu kho nhả món → reserved -1 ở dòng cũ.
   *     Giữ chỗ của ĐƠN thuê/bán KHÔNG dùng warehouseHold (đã nằm trong InventoryReservation).
   * - options.adjustments: điều chỉnh thêm không gắn với món, gộp vào cùng lệnh $inc và cùng bước kiểm tra
   *     (vd TASK-010 bàn giao: [{ locationId, storageId: null, variantId, quantityReserved: -qty }]).
   * Ghi món bằng updateOne có điều kiện (status/location/kệ như lúc đọc): món vừa bị đổi → 409.
   */
  const moveItems = async (items, changes = {}, session, { adjustments = [] } = {}) => {
    requireSession(session);
    const list = (items || []).filter(Boolean);
    const befores = []; const afters = []; const holds = []; const writes = [];
    for (const item of list) {
      const change = (typeof changes === 'function' ? changes(item) : changes) || {};
      const before = stateOf(item);
      const after = { ...before };
      if (change.status !== undefined) after.status = change.status;
      if (change.locationId !== undefined) after.locationId = change.locationId;
      if (change.storageId !== undefined) after.storageId = change.storageId || null;
      bucketOf(after.status);
      const $set = {};
      if (after.status !== before.status) $set.status = after.status;
      if (!sameId(after.locationId, before.locationId)) $set.locationId = after.locationId;
      if (!sameId(after.storageId, before.storageId)) $set.storageId = after.storageId;
      if (change.condition !== undefined && change.condition !== item.condition) $set.condition = change.condition;
      befores.push(before); afters.push(after); holds.push(change.warehouseHold || 0);
      writes.push({ item, before, $set });
    }
    const deltas = mergeBalanceDeltas(computeBalanceDeltas(befores, afters, holds), adjustments);

    for (const { item, before, $set } of writes) {
      if (!Object.keys($set).length) continue;
      const result = await InventoryItem.updateOne(
        { _id: item._id, status: before.status, locationId: before.locationId, storageId: before.storageId ?? null },
        { $set },
        { session, runValidators: true },
      );
      if ((result?.matchedCount ?? result?.n ?? 0) !== 1) throw fail(`Món hàng ${item.itemCode || item._id} vừa thay đổi trạng thái hoặc vị trí, vui lòng tải lại.`, 409);
      for (const field of [...STATE_FIELDS, 'condition']) if (field in $set) item[field] = $set[field];
    }
    await applyDeltas(deltas, session);
    return list;
  };

  const moveItem = async (item, changes, session, options) => (await moveItems([item], changes, session, options))[0];

  /** Tạo món mới (nhập kho, phát hiện thừa khi kiểm kê) và cộng balance tương ứng. Trả về các document đã tạo. */
  const createItems = async (docs, session) => {
    requireSession(session);
    if (!docs?.length) return [];
    for (const doc of docs) bucketOf(doc.status || 'available');
    const created = await InventoryItem.insertMany(docs.map((doc) => ({ status: 'available', storageId: null, ...doc })), { session });
    const deltas = computeBalanceDeltas(created.map(() => null), created.map(stateOf));
    await applyDeltas(deltas, session);
    return created;
  };

  return { moveItems, moveItem, createItems, applyDeltas };
};

/**
 * TASK-014 G1: sổ biến động của hàng `individual` luôn ghi MỖI MÓN MỘT DÒNG có `itemId`, để xem lịch sử
 * di chuyển của từng mã hàng. `movement` là phần chung (variantId, locationId, storageId, movementType,
 * referenceType, referenceId, createdBy...); `quantityChange` mặc định ±1 theo dấu của movement.quantityChange.
 */
export const itemMovementDocs = (items, movement) => {
  const sign = Number(movement.quantityChange) < 0 ? -1 : 1;
  return (items || []).filter(Boolean).map((item) => ({
    ...movement,
    variantId: movement.variantId ?? (item.variantId?._id ?? item.variantId),
    itemId: item._id,
    quantityChange: sign,
  }));
};

/** Ghi sổ biến động cho từng món (trong transaction). */
export const recordItemMovements = async (items, movement, session) => {
  if (!session) throw new Error('recordItemMovements phải chạy trong transaction: thiếu session.');
  const docs = itemMovementDocs(items, movement);
  if (!docs.length) return [];
  return StockMovementModel.insertMany(docs, { session });
};

const defaultService = createItemStateService({ InventoryItem: InventoryItemModel, InventoryBalance: InventoryBalanceModel });
export const { moveItems, moveItem, createItems } = defaultService;
export const applyItemBalanceDeltas = defaultService.applyDeltas;
