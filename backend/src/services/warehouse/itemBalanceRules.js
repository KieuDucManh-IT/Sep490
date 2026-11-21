// Quy tắc quy đổi trạng thái InventoryItem → InventoryBalance cho hàng trackingType `individual` (TASK-009).
// File này KHÔNG import model/DB để unit test chạy được không cần MongoDB.
//
// Với mỗi dòng balance (locationId, storageId, variantId):
//   quantityOnHand      = số món status ∈ ON_HAND_STATUSES
//   quantityUnavailable = số món status ∈ UNAVAILABLE_STATUSES
//   quantityReserved    = số món `reserved` đang bị PHIẾU KHO giữ (warehouseHold)
//                         + (chỉ dòng storageId null của chi nhánh) tổng InventoryReservation active của đơn thuê/bán
//   quantityRenting     = số món `renting`, ghi trên dòng storageId null của location (TASK-010 thêm cột)
// in_transit, disposed, sold: không tính ở đâu.
import { appError as fail } from './shared/errors.js';

export const ON_HAND_STATUSES = Object.freeze(['available', 'reserved', 'unavailable', 'maintenance']);
export const UNAVAILABLE_STATUSES = Object.freeze(['unavailable', 'maintenance']);
export const OFF_HAND_STATUSES = Object.freeze(['in_transit', 'renting', 'disposed', 'sold']);
export const BALANCE_FIELDS = Object.freeze(['quantityOnHand', 'quantityReserved', 'quantityUnavailable', 'quantityRenting']);

export const idOf = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object' && value._id && value._id !== value) return String(value._id);
  return String(value);
};

/** Trả về phần đóng góp của một món vào balance theo trạng thái. Trạng thái lạ → 400 (tránh gõ sai như 'damaged'). */
export const bucketOf = (status) => {
  if (ON_HAND_STATUSES.includes(status)) return { onHand: 1, unavailable: UNAVAILABLE_STATUSES.includes(status) ? 1 : 0, renting: 0 };
  if (status === 'renting') return { onHand: 0, unavailable: 0, renting: 1 };
  if (OFF_HAND_STATUSES.includes(status)) return { onHand: 0, unavailable: 0, renting: 0 };
  throw fail(`Trạng thái món hàng không hợp lệ: ${status}.`, 400);
};

export const balanceKey = ({ locationId, storageId, variantId }) => `${idOf(locationId)}|${idOf(storageId)}|${idOf(variantId)}`;

const emptyLine = ({ locationId, storageId, variantId }) => ({
  locationId, storageId: storageId ?? null, variantId,
  inc: { quantityOnHand: 0, quantityReserved: 0, quantityUnavailable: 0, quantityRenting: 0 },
});

const addTo = (lines, ref, field, amount) => {
  if (!amount) return;
  const key = balanceKey(ref);
  if (!lines.has(key)) lines.set(key, emptyLine(ref));
  lines.get(key).inc[field] += amount;
};

const addBucket = (lines, state, sign) => {
  const bucket = bucketOf(state.status);
  addTo(lines, state, 'quantityOnHand', sign * bucket.onHand);
  addTo(lines, state, 'quantityUnavailable', sign * bucket.unavailable);
  // Món đang cho thuê luôn ghi ở dòng storageId null của location (chi nhánh không chia kệ).
  addTo(lines, { ...state, storageId: null }, 'quantityRenting', sign * bucket.renting);
};

const compactLines = (lines) => [...lines.values()]
  .map((line) => ({ ...line, inc: Object.fromEntries(Object.entries(line.inc).filter(([, value]) => value !== 0)) }))
  .filter((line) => Object.keys(line.inc).length > 0);

/**
 * Hàm thuần: tính phần chênh balance khi các món đổi trạng thái/vị trí.
 * - beforeStates[i] / afterStates[i]: `{ locationId, storageId, variantId, status }` hoặc null (null trước = tạo mới, null sau = xóa).
 * - holds[i]: +1 khi phiếu kho bắt đầu giữ món (cộng `quantityReserved` ở dòng SAU, món sau phải `reserved`);
 *             -1 khi phiếu kho nhả món (trừ `quantityReserved` ở dòng TRƯỚC, món trước phải `reserved`).
 * Trả về danh sách `{ locationId, storageId, variantId, inc }`, mỗi dòng balance một lần, bỏ cột/dòng bằng 0.
 */
export const computeBalanceDeltas = (beforeStates = [], afterStates = [], holds = []) => {
  if (beforeStates.length !== afterStates.length) throw new Error('computeBalanceDeltas: beforeStates và afterStates phải cùng độ dài.');
  const lines = new Map();
  for (let index = 0; index < beforeStates.length; index += 1) {
    const before = beforeStates[index];
    const after = afterStates[index];
    const hold = Number(holds[index] || 0);
    if (![-1, 0, 1].includes(hold)) throw fail('warehouseHold chỉ nhận +1, -1 hoặc 0.', 400);
    if (before && after && idOf(before.variantId) !== idOf(after.variantId)) throw fail('Không thể đổi biến thể của món hàng.', 400);
    if (before) addBucket(lines, before, -1);
    if (after) addBucket(lines, after, 1);
    if (hold === 1) {
      if (!after || after.status !== 'reserved') throw fail('Phiếu kho chỉ giữ được món ở trạng thái reserved.', 400);
      addTo(lines, after, 'quantityReserved', 1);
    } else if (hold === -1) {
      if (!before || before.status !== 'reserved') throw fail('Phiếu kho chỉ nhả được món đang ở trạng thái reserved.', 400);
      addTo(lines, before, 'quantityReserved', -1);
    }
  }
  return compactLines(lines);
};

/** Gộp thêm các điều chỉnh balance không gắn với món cụ thể (ví dụ TASK-010: `quantityReserved: -qty` của đơn khi bàn giao). */
export const mergeBalanceDeltas = (...groups) => {
  const lines = new Map();
  for (const group of groups) {
    for (const row of group || []) {
      const inc = row.inc || Object.fromEntries(BALANCE_FIELDS.filter((field) => row[field]).map((field) => [field, row[field]]));
      for (const [field, amount] of Object.entries(inc)) {
        if (!BALANCE_FIELDS.includes(field)) throw fail(`Cột balance không hợp lệ: ${field}.`, 400);
        addTo(lines, row, field, Number(amount) || 0);
      }
    }
  }
  return compactLines(lines);
};

/** Trả về thông báo lỗi nếu dòng balance vi phạm invariant, ngược lại null. Cột thiếu coi là 0. */
export const checkBalanceInvariant = (row) => {
  const value = (field) => Number(row?.[field] || 0);
  const negative = BALANCE_FIELDS.filter((field) => value(field) < 0);
  if (negative.length) return `Tồn kho không được âm (${negative.map((field) => `${field} = ${value(field)}`).join(', ')}).`;
  if (value('quantityOnHand') < value('quantityReserved') + value('quantityUnavailable')) {
    return `Tồn thực tế (${value('quantityOnHand')}) nhỏ hơn số đang giữ (${value('quantityReserved')}) cộng số không khả dụng (${value('quantityUnavailable')}).`;
  }
  return null;
};

export const assertBalanceInvariant = (row, label = '') => {
  const message = checkBalanceInvariant(row);
  if (message) throw fail(`${label ? `${label}: ` : ''}${message} Thao tác đã bị hủy, vui lòng tải lại hoặc báo quản lý kho đối soát tồn.`, 409);
  return row;
};

/**
 * Hàm thuần: áp phần chênh vào bản sao các dòng balance hiện có (Map key → row) và kiểm tra invariant.
 * Không sửa input; lỗi → 409. Dùng để mô phỏng / test (AC7) giống hệt bước kiểm tra sau ghi trong itemStateService.
 */
export const applyBalanceDeltas = (rowsByKey, deltas) => {
  const next = new Map([...rowsByKey].map(([key, row]) => [key, { ...row }]));
  for (const delta of deltas) {
    const key = balanceKey(delta);
    const row = next.get(key) || { locationId: delta.locationId, storageId: delta.storageId ?? null, variantId: delta.variantId, quantityOnHand: 0, quantityReserved: 0, quantityUnavailable: 0, quantityRenting: 0 };
    for (const [field, amount] of Object.entries(delta.inc)) row[field] = Number(row[field] || 0) + amount;
    next.set(key, row);
  }
  for (const delta of deltas) assertBalanceInvariant(next.get(balanceKey(delta)));
  return next;
};

/* ------------------------------ Đối soát (thuần) ------------------------------ */

/**
 * Tính balance mong đợi từ số liệu đã gom:
 * - statusCounts: [{ locationId, storageId, variantId, status, count }]
 * - heldCounts:   [{ locationId, storageId, variantId, count }] số món `reserved` đang bị phiếu kho giữ
 * - orderReserved:[{ locationId, variantId, quantity }] tổng InventoryReservation active (chỉ chi nhánh) → dòng storageId null
 * Trả về Map key → { locationId, storageId, variantId, quantityOnHand, quantityReserved, quantityUnavailable, quantityRenting }.
 */
export const computeExpectedBalances = ({ statusCounts = [], heldCounts = [], orderReserved = [] } = {}) => {
  const lines = new Map();
  for (const row of statusCounts) {
    const count = Number(row.count || 0);
    if (!count) continue;
    const bucket = bucketOf(row.status);
    addTo(lines, row, 'quantityOnHand', bucket.onHand * count);
    addTo(lines, row, 'quantityUnavailable', bucket.unavailable * count);
    addTo(lines, { ...row, storageId: null }, 'quantityRenting', bucket.renting * count);
    // Đảm bảo dòng của món off-hand (in_transit...) không sinh dòng rỗng: addTo bỏ qua amount 0.
  }
  for (const row of heldCounts) addTo(lines, row, 'quantityReserved', Number(row.count || 0));
  for (const row of orderReserved) addTo(lines, { ...row, storageId: null }, 'quantityReserved', Number(row.quantity || 0));
  const expected = new Map();
  for (const [key, line] of lines) expected.set(key, { locationId: line.locationId, storageId: line.storageId, variantId: line.variantId, ...line.inc });
  return expected;
};

/**
 * So sánh balance mong đợi với balance đang lưu.
 * - fields: các cột cần so (mặc định 3 cột cũ; thêm 'quantityRenting' khi model có cột).
 * Trả về { mismatches: [{ key, locationId, storageId, variantId, field, actual, expected }], upserts: [{ key, ..., set }], deletes: [key] }.
 * Dòng có mọi cột mong đợi = 0 → xóa (nếu đang tồn tại).
 */
export const diffBalances = (expectedByKey, actualRows, fields = ['quantityOnHand', 'quantityReserved', 'quantityUnavailable']) => {
  const actualByKey = new Map();
  for (const row of actualRows) {
    const key = balanceKey(row);
    const current = actualByKey.get(key);
    // Không nên có trùng key (index unique) nhưng vẫn cộng dồn để phát hiện.
    if (current) for (const field of fields) current[field] = Number(current[field] || 0) + Number(row[field] || 0);
    else actualByKey.set(key, { ...row });
  }
  const keys = new Set([...expectedByKey.keys(), ...actualByKey.keys()]);
  const mismatches = []; const upserts = []; const deletes = [];
  for (const key of [...keys].sort()) {
    const expected = expectedByKey.get(key);
    const actual = actualByKey.get(key);
    const ref = expected || actual;
    const expectedValue = (field) => Number(expected?.[field] || 0);
    const actualValue = (field) => Number(actual?.[field] || 0);
    const changed = fields.filter((field) => expectedValue(field) !== actualValue(field));
    for (const field of changed) mismatches.push({ key, locationId: ref.locationId, storageId: ref.storageId ?? null, variantId: ref.variantId, field, actual: actualValue(field), expected: expectedValue(field) });
    const allZero = fields.every((field) => expectedValue(field) === 0);
    if (allZero) { if (actual) deletes.push(key); continue; }
    if (changed.length || !actual) upserts.push({ key, locationId: ref.locationId, storageId: ref.storageId ?? null, variantId: ref.variantId, set: Object.fromEntries(fields.map((field) => [field, expectedValue(field)])) });
  }
  return { mismatches, upserts, deletes };
};
