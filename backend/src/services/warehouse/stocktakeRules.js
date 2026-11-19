// Hàm thuần của kiểm kê (không import model, có unit test):
// - chọn dòng: khóa cặp (biến thể, vị trí), lọc dòng chụp số theo danh sách cặp WM đã chọn, gom dòng thành cặp
//   để xem trước, kiểm cặp có nằm trong phạm vi phiếu;
// - hàng hỏng của hàng quản lý theo số lượng: số "không khả dụng" sau kiểm kê.

/** Khóa duy nhất của một cặp (biến thể, vị trí); vị trí rỗng = dòng không có kệ. */
export const stocktakePairKey = (variantId, storageId) => `${String(variantId?._id || variantId || '')}|${String(storageId?._id || storageId || '')}`;

/**
 * Chỉ giữ các dòng chụp số thuộc danh sách cặp đã chọn. `lines` rỗng / không có → giữ nguyên (hành vi cũ).
 * Hàng individual: mọi món của cặp được giữ.
 */
export const filterRowsByLines = (rows, lines) => {
  if (!Array.isArray(lines) || !lines.length) return rows;
  const wanted = new Set(lines.map((line) => stocktakePairKey(line.variantId, line.storageId)));
  return rows.filter((row) => wanted.has(stocktakePairKey(row.variantId, row.storageId)));
};

/**
 * Gom dòng chụp số thành cặp (biến thể, vị trí) để xem trước.
 * `systemQuantity`: hàng số lượng = onHand của dòng balance; hàng individual = số món.
 */
export const groupRowsToPairs = (rows, trackingByVariant = new Map()) => {
  const pairs = new Map();
  for (const row of rows) {
    const key = stocktakePairKey(row.variantId, row.storageId);
    if (!pairs.has(key)) {
      pairs.set(key, {
        variantId: String(row.variantId),
        storageId: row.storageId ? String(row.storageId) : null,
        trackingType: trackingByVariant.get(String(row.variantId)) || (row.itemId ? 'individual' : 'quantity'),
        systemQuantity: 0,
      });
    }
    pairs.get(key).systemQuantity += Number(row.systemQuantity) || 0;
  }
  return [...pairs.values()];
};

/**
 * Cặp nằm ngoài phạm vi phiếu. `variantIds` = Set biến thể của phạm vi sản phẩm (null = mọi biến thể);
 * `storageIds` = Set kệ của phạm vi vị trí đã mở rộng cấp con (null = mọi vị trí, kể cả dòng không có kệ).
 */
export const pairsOutOfScope = (lines, { variantIds = null, storageIds = null } = {}) => lines.filter((line) => {
  if (variantIds && !variantIds.has(String(line.variantId))) return true;
  if (storageIds && !storageIds.has(String(line.storageId || ''))) return true;
  return false;
});

/** Số hàng hỏng đề xuất sẵn khi chụp số: phần đang không khả dụng của dòng balance (không vượt onHand). */
export const initialDamagedQuantity = (balance) => Math.max(0, Math.min(
  Number(balance?.quantityUnavailable) || 0,
  Number(balance?.quantityOnHand) || 0,
));

/** "Không khả dụng" của dòng hàng số lượng sau kiểm kê = min(số hỏng đếm được, tồn sau điều chỉnh). */
export const unavailableAfterStocktake = (damagedQuantity, onHandAfter) => Math.max(0, Math.min(
  Number(damagedQuantity) || 0,
  Number(onHandAfter) || 0,
));

/**
 * Kiểm số hỏng của một dòng hàng số lượng: số nguyên, 0 ≤ hỏng ≤ số đếm. Trả message lỗi hoặc null.
 * `null` / `undefined` coi là không gửi (người gọi giữ giá trị cũ).
 */
export const damagedQuantityError = (damagedQuantity, countedQuantity) => {
  if (damagedQuantity == null) return null;
  const damaged = Number(damagedQuantity);
  if (damagedQuantity === '' || !Number.isInteger(damaged) || damaged < 0) return 'Số hàng hỏng phải là số nguyên không âm.';
  if (countedQuantity != null && damaged > Number(countedQuantity)) return 'Số hàng hỏng không được lớn hơn số lượng thực tế.';
  return null;
};

/**
 * Dòng điều chỉnh hàng số lượng có cần tạo không: lệch số lượng, hoặc số không khả dụng sau kiểm kê khác hiện tại.
 * Trả về { change, unavailableAfter } (unavailableAfter = null nếu dòng không ghi số hỏng).
 */
export const quantityAdjustmentNeed = ({ expectedNow, before, damagedQuantity, unavailableNow }) => {
  const change = expectedNow - before;
  if (damagedQuantity == null) return { change, unavailableAfter: null, needed: change !== 0 };
  const unavailableAfter = unavailableAfterStocktake(damagedQuantity, expectedNow);
  return { change, unavailableAfter, needed: change !== 0 || unavailableAfter !== (Number(unavailableNow) || 0) };
};
