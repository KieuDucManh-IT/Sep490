// TASK-009 — Đối soát InventoryBalance với các InventoryItem (nguồn gốc).
// TASK-015: mọi sản phẩm quản lý theo món nên đối soát mọi biến thể. `--fix` (bulkWrite) là chỗ ghi balance
// hợp lệ duy nhất ngoài itemStateService (công cụ đối soát).
// Quy tắc tính nằm ở itemBalanceRules.js (computeExpectedBalances, diffBalances — có unit test).
import mongoose from 'mongoose';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryReservation } from '../../models/warehouse/inventory/InventoryReservation.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { StockRelocation } from '../../models/warehouse/transfer/StockRelocation.js';
import { StockRelocationDetail } from '../../models/warehouse/transfer/StockRelocationDetail.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
import { StockTransferDetail } from '../../models/warehouse/transfer/StockTransferDetail.js';
import { RentalOrderItem } from '../../models/sale&rental/RentalOrderItem.js';
import { balanceKey, checkBalanceInvariant, computeExpectedBalances, diffBalances } from './itemBalanceRules.js';

const BASE_FIELDS = ['quantityOnHand', 'quantityReserved', 'quantityUnavailable'];
const ORDER_RESERVATION_TYPES = ['sale', 'rental'];
const toObjectIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));
const withSession = (query, session) => (session ? query.session(session) : query);

export const balanceFieldsInUse = () => (InventoryBalance.schema.path('quantityRenting') ? [...BASE_FIELDS, 'quantityRenting'] : BASE_FIELDS);

/** Biến thể cần đối soát: danh sách truyền vào, hoặc mọi biến thể. */
const variantIdsToReconcile = async ({ variantIds } = {}, session) => {
  const filter = {};
  if (variantIds?.length) filter._id = { $in: toObjectIds(variantIds) };
  return withSession(ProductVariant.find(filter).distinct('_id'), session);
};

/**
 * Id các món `reserved` đang bị PHIẾU KHO giữ:
 * - phiếu tách/gộp kệ `assigned | in_progress` (StockRelocationDetail.itemIds)
 * - phiếu chi nhánh trả về `approved` (chưa gửi) (StockTransferDetail.itemIds)
 * Món reserved do đơn thuê gán (RentalOrderItem `assigned`) KHÔNG tính ở đây: giữ chỗ của đơn đã nằm trong InventoryReservation.
 */
export const warehouseHeldItemIds = async (session) => {
  const [relocationIds, returnIds] = await Promise.all([
    withSession(StockRelocation.find({ status: { $in: ['assigned', 'in_progress'] } }).distinct('_id'), session),
    withSession(StockTransfer.find({ direction: 'branch_to_central', status: 'approved' }).distinct('_id'), session),
  ]);
  const [relocationLines, returnLines] = await Promise.all([
    relocationIds.length ? withSession(StockRelocationDetail.find({ relocationId: { $in: relocationIds } }).select('itemIds').lean(), session) : [],
    returnIds.length ? withSession(StockTransferDetail.find({ transferId: { $in: returnIds } }).select('itemIds').lean(), session) : [],
  ]);
  return new Set([...relocationLines, ...returnLines].flatMap((line) => (line.itemIds || []).map(String)));
};

/** Tính balance mong đợi theo trạng thái các món (bảng quy đổi TASK-009 mục 3). Giữ tên cũ cho script/chỗ gọi. */
export const computeExpectedIndividualBalances = async ({ variantIds, locationIds } = {}, session = null) => {
  const ids = await variantIdsToReconcile({ variantIds }, session);
  if (!ids.length) return { variantIds: [], expected: new Map(), orphanReservedItemIds: [] };
  const match = { variantId: { $in: ids } };
  if (locationIds?.length) match.locationId = { $in: toObjectIds(locationIds) };

  const statusCounts = (await withSession(InventoryItem.aggregate([
    { $match: match },
    { $group: { _id: { locationId: '$locationId', storageId: { $ifNull: ['$storageId', null] }, variantId: '$variantId', status: '$status' }, count: { $sum: 1 } } },
  ]), session)).map((row) => ({ ...row._id, count: row.count }));

  const heldIds = await warehouseHeldItemIds(session);
  const reservedItems = await withSession(InventoryItem.find({ ...match, status: 'reserved' }).select('_id locationId storageId variantId').lean(), session);
  const heldMap = new Map();
  const notHeld = [];
  for (const item of reservedItems) {
    if (!heldIds.has(String(item._id))) { notHeld.push(item._id); continue; }
    const key = balanceKey(item);
    if (!heldMap.has(key)) heldMap.set(key, { locationId: item.locationId, storageId: item.storageId ?? null, variantId: item.variantId, count: 0 });
    heldMap.get(key).count += 1;
  }
  // Món reserved không thuộc phiếu kho và cũng không được gán cho đơn thuê nào → cảnh báo (dữ liệu treo).
  const assignedToOrder = notHeld.length
    ? new Set((await withSession(RentalOrderItem.find({ itemId: { $in: notHeld }, status: 'assigned' }).distinct('itemId'), session)).map(String))
    : new Set();
  const orphanReservedItemIds = notHeld.filter((id) => !assignedToOrder.has(String(id)));

  const storeIds = await withSession(InventoryLocation.find({ type: 'store', ...(locationIds?.length ? { _id: { $in: toObjectIds(locationIds) } } : {}) }).distinct('_id'), session);
  const orderReserved = storeIds.length ? (await withSession(InventoryReservation.aggregate([
    { $match: { status: 'active', orderType: { $in: ORDER_RESERVATION_TYPES }, variantId: { $in: ids }, locationId: { $in: storeIds } } },
    { $group: { _id: { locationId: '$locationId', variantId: '$variantId' }, quantity: { $sum: '$quantity' } } },
  ]), session)).map((row) => ({ ...row._id, quantity: row.quantity })) : [];

  const expected = computeExpectedBalances({ statusCounts, heldCounts: [...heldMap.values()], orderReserved });
  return { variantIds: ids, expected, orphanReservedItemIds };
};

const describeRows = async (rows, session) => {
  const locationIds = [...new Set(rows.map((row) => String(row.locationId)))];
  const storageIds = [...new Set(rows.map((row) => row.storageId && String(row.storageId)).filter(Boolean))];
  const variantIds = [...new Set(rows.map((row) => String(row.variantId)))];
  const [locations, storages, variants] = await Promise.all([
    locationIds.length ? withSession(InventoryLocation.find({ _id: { $in: locationIds } }).select('code').lean(), session) : [],
    storageIds.length ? withSession(StorageLocation.find({ _id: { $in: storageIds } }).select('code').lean(), session) : [],
    variantIds.length ? withSession(ProductVariant.find({ _id: { $in: variantIds } }).select('sku').lean(), session) : [],
  ]);
  const codeOf = (list, field) => new Map(list.map((row) => [String(row._id), row[field]]));
  const locationCode = codeOf(locations, 'code'); const storageCode = codeOf(storages, 'code'); const sku = codeOf(variants, 'sku');
  return rows.map((row) => ({
    locationCode: locationCode.get(String(row.locationId)) || String(row.locationId),
    storageCode: row.storageId ? storageCode.get(String(row.storageId)) || String(row.storageId) : null,
    sku: sku.get(String(row.variantId)) || String(row.variantId),
    ...row,
  }));
};

/**
 * So balance đang lưu với balance mong đợi tính từ các món.
 * - fix: false (mặc định) chỉ đọc. fix: true ghi lại đúng giá trị và xóa dòng mọi cột mong đợi bằng 0 — chạy trong một transaction.
 * Trả về { mismatches: [{ locationCode, storageCode, sku, field, actual, expected }], fixed, upserted, deleted, invariantViolations, orphanReservedItemIds }.
 */
export const reconcileIndividualBalances = async ({ fix = false, variantIds, locationIds } = {}) => {
  const run = async (session) => {
    const fields = balanceFieldsInUse();
    const { variantIds: ids, expected, orphanReservedItemIds } = await computeExpectedIndividualBalances({ variantIds, locationIds }, session);
    if (!ids.length) return { mismatches: [], fixed: false, upserted: 0, deleted: 0, invariantViolations: [], orphanReservedItemIds: [] };
    const balanceFilter = { variantId: { $in: ids } };
    if (locationIds?.length) balanceFilter.locationId = { $in: toObjectIds(locationIds) };
    const actualRows = await withSession(InventoryBalance.find(balanceFilter).lean(), session);
    const { mismatches, upserts, deletes } = diffBalances(expected, actualRows, fields);
    const invariantViolations = [...expected.values()]
      .map((row) => ({ ...row, problem: checkBalanceInvariant(row) }))
      .filter((row) => row.problem);

    let upserted = 0; let deleted = 0;
    if (fix && (upserts.length || deletes.length)) {
      const actualByKey = new Map(actualRows.map((row) => [balanceKey(row), row]));
      const ops = [
        ...upserts.map((row) => ({ updateOne: {
          filter: { locationId: row.locationId, storageId: row.storageId ?? null, variantId: row.variantId },
          update: { $set: row.set },
          upsert: true,
        } })),
        ...deletes.map((key) => ({ deleteOne: { filter: { _id: actualByKey.get(key)._id } } })),
      ];
      // updateOne + upsert của bulkWrite không áp default của schema cho cột không có trong $set → $set đủ mọi cột đang dùng.
      await InventoryBalance.bulkWrite(ops, { ordered: true, ...(session ? { session } : {}) });
      upserted = upserts.length; deleted = deletes.length;
    }
    return {
      mismatches: await describeRows(mismatches, session),
      fixed: Boolean(fix),
      upserted,
      deleted,
      invariantViolations: await describeRows(invariantViolations, session),
      orphanReservedItemIds: orphanReservedItemIds.map(String),
    };
  };

  if (!fix) return run(null);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => { result = await run(session); });
  } finally { await session.endSession(); }
  return result;
};
