// TASK-010 — Tồn kho cho đơn thuê/bán tại chi nhánh (dòng balance `storageId: null`).
// - Giữ chỗ nguyên tử: một lệnh có điều kiện `onHand − reserved − unavailable ≥ qty` (không upsert), ghi qua
//   itemStateService.adjustOrderReservation (TASK-015: file này không còn ghi balance trực tiếp).
// - Đổi trạng thái món (gán, bàn giao, nhận trả, hủy, bán) đi qua itemStateService (TASK-009).
// - Phần `quantityReserved` của ĐƠN nằm trong InventoryReservation `active`; nhả theo đúng số đang active.
// Hàm thuần ở đầu file (availableFromBalances, canReserve, returnTransition, ...) có unit test.
import { InventoryBalance as InventoryBalanceModel } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem as InventoryItemModel } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryReservation as InventoryReservationModel } from '../../models/warehouse/inventory/InventoryReservation.js';
import { idOf } from './itemBalanceRules.js';
import {
  adjustOrderReservation as defaultAdjustOrderReservation, moveItems as defaultMoveItems,
} from './itemStateService.js';
import { availableOf, sumAvailable } from './balanceQueryService.js';

/** Tình trạng món không được bán/cho thuê dù status `available`. */
export const UNUSABLE_CONDITIONS = Object.freeze(['damaged', 'unrepairable', 'missing']);

/** Lỗi nghiệp vụ dùng chung cho các service đơn hàng (controller đơn đọc `status`, controller khác đọc `statusCode`). */
export const orderError = (status, message, code = null, details = null) =>
  Object.assign(new Error(message), { name: 'ServiceError', status, statusCode: status, code, details });

/** Lỗi ném từ helper kho chỉ có `statusCode` → bổ sung `status` để controller đơn trả đúng mã thay vì 500. */
export const withStatus = (err) => {
  if (err && err.statusCode && !err.status) err.status = err.statusCode;
  if (err && err.status && !err.statusCode) err.statusCode = err.status;
  return err;
};

const num = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);

/* ------------------------------------------------ Hàm thuần ------------------------------------------------ */

/** Khả dụng của một dòng balance — TASK-011: công thức dùng chung ở balanceQueryService (giữ tên cũ để không vỡ chỗ gọi). */
export const availableOfBalance = availableOf;

/** Khả dụng cho khách tại một chi nhánh = Σ khả dụng các dòng balance (mọi loại hàng, không đếm món). */
export const availableFromBalances = sumAvailable;

/** Điều kiện giữ chỗ (đúng điều kiện `$expr` của itemStateService.orderReservationFilter). */
export const canReserve = (row, quantity) => Boolean(row) && Number(quantity) > 0 && availableOfBalance(row) >= Number(quantity);

/** Gộp các dòng đơn theo biến thể: [{ variantId, quantity, sku }] → mảng đã cộng dồn. */
export const aggregateLines = (lines = []) => {
  const map = new Map();
  for (const line of lines || []) {
    const key = idOf(line.variantId);
    const quantity = Number(line.quantity) || 0;
    if (!map.has(key)) map.set(key, { variantId: line.variantId, quantity: 0, sku: line.sku });
    map.get(key).quantity += quantity;
  }
  return [...map.values()].filter((line) => line.quantity > 0);
};

/**
 * Bảng quy đổi khi nhận trả đồ thuê (người dùng chốt 17/11). Không dùng `maintenance` ở chi nhánh:
 *   new/good → available; worn/damaged → unavailable; unrepairable → unavailable + condition unrepairable.
 * `condition` của món luôn cập nhật theo conditionOnReturn.
 */
export const RETURN_TRANSITIONS = Object.freeze({
  new: Object.freeze({ status: 'available', condition: 'new' }),
  good: Object.freeze({ status: 'available', condition: 'good' }),
  worn: Object.freeze({ status: 'unavailable', condition: 'worn' }),
  damaged: Object.freeze({ status: 'unavailable', condition: 'damaged' }),
  unrepairable: Object.freeze({ status: 'unavailable', condition: 'unrepairable' }),
});

export const returnTransition = (conditionOnReturn) => {
  const transition = RETURN_TRANSITIONS[conditionOnReturn];
  if (!transition) throw orderError(400, `Tình trạng khi trả không hợp lệ: ${conditionOnReturn}.`);
  return { ...transition };
};

const isWriteConflict = (err) => err?.code === 112 || err?.codeName === 'WriteConflict'
  || (typeof err?.hasErrorLabel === 'function' && err.hasErrorLabel('TransientTransactionError'));

/* --------------------------------------------- Service có model --------------------------------------------- */

/**
 * Tạo service với model truyền vào (test dùng model giả). Bản mặc định ở cuối file dùng model thật.
 * `InventoryBalance` chỉ dùng để ĐỌC (báo số còn lại khi hết hàng); mọi lệnh ghi đi qua `moveItems` /
 * `adjustOrderReservation` của itemStateService.
 */
export const createOrderStockService = ({
  InventoryBalance, InventoryItem, InventoryReservation, moveItems, adjustOrderReservation,
} = {}) => {
  const requireSession = (session) => {
    if (!session) throw new Error('orderStockService phải chạy trong transaction: thiếu session.');
  };
  const withSession = (query, session) => (query && typeof query.session === 'function' ? query.session(session) : query);
  const lean = (query) => (query && typeof query.lean === 'function' ? query.lean() : query);

  /**
   * Giữ chỗ cho đơn: mỗi biến thể một lệnh giữ có điều kiện trên dòng chi nhánh (storageId null), KHÔNG upsert.
   * Không đủ hàng / không có dòng balance → 409 ERR_OUT_OF_STOCK. Hai request giành món cuối: request sau
   * hoặc thấy điều kiện sai, hoặc bị WriteConflict trong transaction → cũng trả 409 ERR_OUT_OF_STOCK.
   */
  const reserveStock = async ({ locationId, lines }, session) => {
    requireSession(session);
    const reserved = [];
    for (const line of aggregateLines(lines)) {
      let row;
      try {
        row = await adjustOrderReservation({ locationId, variantId: line.variantId, quantity: line.quantity }, session);
      } catch (err) {
        if (isWriteConflict(err)) {
          throw orderError(409, `Sản phẩm ${line.sku || line.variantId} vừa được khách khác đặt, vui lòng thử lại.`, 'ERR_OUT_OF_STOCK',
            { variantId: idOf(line.variantId), requestedQuantity: line.quantity });
        }
        throw err;
      }
      if (!row) {
        const rows = await lean(withSession(InventoryBalance.find({ locationId, variantId: line.variantId }), session));
        const availableQuantity = availableFromBalances(rows);
        throw orderError(409, `Sản phẩm ${line.sku || line.variantId} chỉ còn ${availableQuantity}.`, 'ERR_OUT_OF_STOCK',
          { variantId: idOf(line.variantId), requestedQuantity: line.quantity, availableQuantity });
      }
      reserved.push({ variantId: line.variantId, quantity: line.quantity });
    }
    return reserved;
  };

  /**
   * Đóng các InventoryReservation `active` của đơn (→ `consumed` | `released`) và trả về số đã giữ theo biến thể.
   * KHÔNG đụng balance: caller tự trừ (hủy: releaseReserved; bàn giao/bán: gộp vào adjustments của moveItems).
   */
  const closeReservations = async ({ orderId, orderType }, nextStatus, session) => {
    requireSession(session);
    const filter = { orderId, status: 'active', ...(orderType ? { orderType } : {}) };
    const active = await lean(withSession(InventoryReservation.find(filter), session));
    const byVariant = new Map();
    for (const row of active || []) {
      const key = idOf(row.variantId);
      byVariant.set(key, (byVariant.get(key) || 0) + num(row.quantity));
    }
    if (active?.length) {
      await InventoryReservation.updateMany({ _id: { $in: active.map((row) => row._id) }, status: 'active' }, { $set: { status: nextStatus } }, { session });
    }
    return byVariant;
  };

  /** Hủy đơn: nhả giữ chỗ đúng bằng số `active` của từng biến thể. Lệch với balance → 409 (cần đối soát). */
  const releaseReserved = async ({ locationId, reservedByVariant }, session) => {
    requireSession(session);
    for (const [variantId, quantity] of reservedByVariant || []) {
      if (quantity <= 0) continue;
      const row = await adjustOrderReservation({ locationId, variantId, quantity: -quantity }, session);
      if (!row) throw orderError(409, 'Tồn kho chi nhánh không khớp với đơn hàng (giữ chỗ hoặc tồn không đủ). Vui lòng báo quản lý kho đối soát tồn.', 'ERR_BALANCE_MISMATCH');
    }
  };

  /** Gán món cho đơn thuê: available → reserved (không warehouseHold, balance không đổi). */
  const reserveItemsForOrder = (items, session) => moveItems(items, { status: 'reserved' }, session);

  /** Hủy đơn thuê: món đã gán reserved → available (balance không đổi; nhả giữ chỗ làm riêng). */
  const releaseItemsFromOrder = (items, session) => moveItems((items || []).filter((item) => item.status === 'reserved'), { status: 'available' }, session);

  /**
   * Bàn giao: món reserved → renting (onHand −1, renting +1) GỘP với nhả giữ chỗ của đơn (reserved −qty)
   * trong cùng một bước $inc + kiểm tra (tránh 409 giả khi trừ onHand trước khi trừ reserved).
   */
  const handoverItems = ({ locationId, items, reservedByVariant }, session) => {
    const adjustments = [...(reservedByVariant || new Map())]
      .filter(([, quantity]) => quantity > 0)
      .map(([variantId, quantity]) => ({ locationId, storageId: null, variantId, quantityReserved: -quantity }));
    return moveItems(items, { status: 'renting' }, session, { adjustments });
  };

  /** Nhận trả đồ thuê: renting → theo RETURN_TRANSITIONS (helper: renting −1, onHand +1, unavailable +1 nếu cần). */
  const returnItems = async (entries, session) => {
    const byId = new Map((entries || []).map(({ item, conditionOnReturn }) => [idOf(item._id), returnTransition(conditionOnReturn)]));
    for (const { item } of entries || []) {
      if (item.status !== 'renting') throw orderError(409, `Món hàng ${item.itemCode || item._id} không ở trạng thái đang cho thuê (hiện tại: ${item.status}).`);
    }
    return moveItems((entries || []).map(({ item }) => item), (item) => byId.get(idOf(item._id)), session);
  };

  /**
   * Hoàn tất đơn bán: chọn FIFO `quantity` món `available` (condition dùng được, cũ nhất theo createdAt)
   * tại chi nhánh → `sold` (onHand −1 mỗi món) gộp với nhả giữ chỗ `reservedQuantity`. Không đủ món → 409.
   */
  const sellItems = async ({ locationId, variantId, quantity, reservedQuantity = 0, sku }, session) => {
    requireSession(session);
    const query = InventoryItem.find({
      locationId, variantId, status: 'available', condition: { $nin: UNUSABLE_CONDITIONS },
    }).sort({ createdAt: 1, _id: 1 }).limit(quantity);
    const items = await withSession(query, session);
    if ((items || []).length < quantity) {
      throw orderError(409, `Sản phẩm ${sku || variantId} chỉ còn ${(items || []).length} món dùng được tại chi nhánh, không đủ ${quantity} để hoàn tất đơn.`, 'ERR_OUT_OF_STOCK',
        { variantId: idOf(variantId), requestedQuantity: quantity, availableQuantity: (items || []).length });
    }
    const adjustments = reservedQuantity > 0 ? [{ locationId, storageId: null, variantId, quantityReserved: -reservedQuantity }] : [];
    return moveItems(items, { status: 'sold' }, session, { adjustments });
  };

  return {
    reserveStock, closeReservations, releaseReserved,
    reserveItemsForOrder, releaseItemsFromOrder, handoverItems, returnItems, sellItems,
  };
};

const defaultService = createOrderStockService({
  InventoryBalance: InventoryBalanceModel,
  InventoryItem: InventoryItemModel,
  InventoryReservation: InventoryReservationModel,
  moveItems: defaultMoveItems,
  adjustOrderReservation: defaultAdjustOrderReservation,
});

export const {
  reserveStock, closeReservations, releaseReserved,
  reserveItemsForOrder, releaseItemsFromOrder, handoverItems, returnItems, sellItems,
} = defaultService;
