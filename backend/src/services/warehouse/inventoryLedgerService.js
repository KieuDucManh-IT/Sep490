// Ghi tồn (InventoryBalance) và sổ biến động (StockMovement) cho hàng quản lý theo số lượng.
// Mọi lệnh trừ / giữ / nhả tồn đều là MỘT lệnh `findOneAndUpdate` có điều kiện, nên hai thao tác đồng thời
// không thể cùng trừ một số tồn (không đọc → sửa → save()). Sau khi ghi luôn kiểm invariant
// onHand ≥ reserved + unavailable; vi phạm → 409 và transaction rollback.
// Hàng `individual` KHÔNG ghi balance ở đây mà đi qua itemStateService (đổi trạng thái từng món).
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { assertBalanceInvariant } from './itemBalanceRules.js';
import { appError } from './shared/errors.js';

const DEFAULT_CHANGED_MESSAGE = 'Tồn khả dụng tại vị trí đã thay đổi';

/** Điều kiện `$expr`: khả dụng (onHand − reserved − unavailable) ≥ quantity, giống reserveFilter của đơn hàng. */
const availableAtLeast = (quantity) => ({
  $expr: {
    $gte: [
      {
        $subtract: [
          { $ifNull: ['$quantityOnHand', 0] },
          { $add: [{ $ifNull: ['$quantityReserved', 0] }, { $ifNull: ['$quantityUnavailable', 0] }] },
        ],
      },
      quantity,
    ],
  },
});

const balanceRowFilter = ({ locationId, storageId = null, variantId }) => ({ locationId, storageId: storageId ?? null, variantId });

/** Cập nhật có điều kiện một dòng balance; không có dòng thỏa điều kiện → 409 với message của nghiệp vụ. */
const updateBalanceOrThrow = async (filter, increments, session, message) => {
  const row = await InventoryBalance.findOneAndUpdate(
    filter,
    { $inc: increments },
    { returnDocument: 'after', runValidators: true, ...(session ? { session } : {}) },
  );
  if (!row) throw appError(message || DEFAULT_CHANGED_MESSAGE, 409);
  const plain = typeof row.toObject === 'function' ? row.toObject() : row;
  assertBalanceInvariant(plain, 'Tồn kho của biến thể');
  return row;
};

/** Cộng tồn (upsert dòng nếu chưa có). Dùng khi nhập hàng vào kho / kệ. */
export const increaseInventoryBalance = ({ locationId, storageId = null, variantId, quantity, increments = {}, session }) =>
  InventoryBalance.findOneAndUpdate(
    { locationId, storageId, variantId },
    { $inc: { quantityOnHand: quantity, ...increments } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) },
  );

/**
 * Trừ tồn thực tế khi hàng rời vị trí (xuất kho, điều chỉnh giảm). Chỉ trừ được phần đang khả dụng:
 * hàng đang giữ cho phiếu/đơn hoặc không khả dụng không được lấy đi.
 */
export const decreaseInventoryBalance = ({ locationId, storageId = null, variantId, quantity, session, message }) =>
  updateBalanceOrThrow(
    { ...balanceRowFilter({ locationId, storageId, variantId }), ...availableAtLeast(quantity) },
    { quantityOnHand: -quantity },
    session,
    message,
  );

/** Giữ tồn cho phiếu kho (trả hàng, tách/gộp kệ): reserved +quantity nếu còn đủ khả dụng. */
export const reserveInventoryBalance = ({ locationId, storageId = null, variantId, quantity, session, message }) =>
  updateBalanceOrThrow(
    { ...balanceRowFilter({ locationId, storageId, variantId }), ...availableAtLeast(quantity) },
    { quantityReserved: quantity },
    session,
    message,
  );

/**
 * Nhả phần đã giữ cho phiếu kho. `alsoRemoveOnHand: true` khi hàng đang giữ rời vị trí
 * (gửi hàng trả, hoàn tất tách/gộp): onHand và reserved cùng giảm.
 */
export const releaseReservedBalance = ({
  locationId, storageId = null, variantId, quantity, alsoRemoveOnHand = false, session, message,
}) => {
  const filter = { ...balanceRowFilter({ locationId, storageId, variantId }), quantityReserved: { $gte: quantity } };
  const increments = { quantityReserved: -quantity };
  if (alsoRemoveOnHand) {
    filter.quantityOnHand = { $gte: quantity };
    increments.quantityOnHand = -quantity;
  }
  return updateBalanceOrThrow(filter, increments, session, message);
};

/**
 * Kiểm kê hàng số lượng: trong MỘT lệnh có điều kiện, đổi onHand theo chênh lệch và đặt "không khả dụng"
 * (hàng hỏng) về `unavailableAfter`. Điều kiện: onHand / unavailable vẫn đúng như lúc duyệt kiểm kê và
 * reserved + unavailableAfter ≤ onHand sau điều chỉnh. Không thỏa → 409, không ghi gì.
 * Dòng chưa có balance (hàng thừa) → tạo mới bằng increaseInventoryBalance.
 */
export const applyCountedQuantityBalance = async ({
  locationId, storageId = null, variantId, quantityBefore, unavailableBefore, change, unavailableAfter, session,
}) => {
  const place = balanceRowFilter({ locationId, storageId, variantId });
  const existing = await InventoryBalance.findOne(place).session(session || null).lean();
  if (!existing) {
    if (quantityBefore !== 0 || (unavailableBefore || 0) !== 0 || change < unavailableAfter) {
      throw appError('Tồn kho đã thay đổi sau khi duyệt kiểm kê. Hãy kiểm kê lại trước khi áp dụng.', 409);
    }
    return increaseInventoryBalance({ ...place, quantity: change, increments: { quantityUnavailable: unavailableAfter }, session });
  }
  const onHandAfter = quantityBefore + change;
  const row = await InventoryBalance.findOneAndUpdate(
    {
      ...place,
      quantityOnHand: quantityBefore,
      quantityUnavailable: unavailableBefore || 0,
      $expr: { $gte: [onHandAfter, { $add: [{ $ifNull: ['$quantityReserved', 0] }, unavailableAfter] }] },
    },
    { $inc: { quantityOnHand: change }, $set: { quantityUnavailable: unavailableAfter } },
    { returnDocument: 'after', runValidators: true, ...(session ? { session } : {}) },
  );
  if (!row) {
    const stale = existing.quantityOnHand !== quantityBefore || (existing.quantityUnavailable || 0) !== (unavailableBefore || 0);
    if (stale) throw appError('Tồn kho đã thay đổi sau khi duyệt kiểm kê. Hãy kiểm kê lại trước khi áp dụng.', 409);
    throw appError(`Số đang giữ (${existing.quantityReserved || 0}) cộng số hỏng (${unavailableAfter}) vượt tồn sau điều chỉnh (${onHandAfter}). Hãy nhả giữ trước khi áp dụng.`, 409);
  }
  assertBalanceInvariant(row.toObject(), 'Tồn kho của biến thể');
  return row;
};

/** Ghi một dòng sổ biến động (trong transaction nếu có session). */
export const recordStockMovement = async (movement, session) => {
  if (session) return (await StockMovement.create([movement], { session }))[0];
  return StockMovement.create(movement);
};
