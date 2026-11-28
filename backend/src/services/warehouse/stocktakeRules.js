// Hàm thuần của kiểm kê (không import model, có unit test):
// - chọn dòng: khóa cặp (biến thể, vị trí), lọc dòng chụp số theo danh sách cặp WM đã chọn, gom dòng thành cặp
//   để xem trước, kiểm cặp có nằm trong phạm vi phiếu.
// TASK-015: mỗi dòng kiểm kê là một món; phần số hỏng của hàng số lượng (TASK-014 E3) đã bỏ.

/** Khóa duy nhất của một cặp (biến thể, vị trí); vị trí rỗng = dòng không có kệ. */
export const stocktakePairKey = (variantId, storageId) => `${String(variantId?._id || variantId || '')}|${String(storageId?._id || storageId || '')}`;

/**
 * Chỉ giữ các dòng chụp số thuộc danh sách cặp đã chọn. `lines` rỗng / không có → giữ nguyên (hành vi cũ).
 * Mọi món của cặp được giữ.
 */
export const filterRowsByLines = (rows, lines) => {
  if (!Array.isArray(lines) || !lines.length) return rows;
  const wanted = new Set(lines.map((line) => stocktakePairKey(line.variantId, line.storageId)));
  return rows.filter((row) => wanted.has(stocktakePairKey(row.variantId, row.storageId)));
};

/**
 * Gom dòng chụp số (mỗi món một dòng) thành cặp (biến thể, vị trí) để xem trước. `systemQuantity` = số món.
 */
export const groupRowsToPairs = (rows) => {
  const pairs = new Map();
  for (const row of rows) {
    const key = stocktakePairKey(row.variantId, row.storageId);
    if (!pairs.has(key)) {
      pairs.set(key, {
        variantId: String(row.variantId),
        storageId: row.storageId ? String(row.storageId) : null,
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
