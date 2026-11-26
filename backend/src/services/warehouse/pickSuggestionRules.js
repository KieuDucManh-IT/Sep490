// Gợi ý vị trí lấy hàng cho phiếu xuất kho tổng → chi nhánh (TASK-014 D2, quyết định 7: ít kệ nhất).
// Hàm thuần, không đọc DB: service truyền vào tồn từng kệ / món available, nhận lại kế hoạch lấy hàng.
// Chỉ là gợi ý: không giữ chỗ, server vẫn kiểm lại khi nhân viên lưu phân bổ / xuất kho.

const idOf = (value) => String(value?._id || value || '');
const positive = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0);

/** So sánh mã vị trí đầy đủ (Khu-Dãy-Kệ) theo thứ tự tự nhiên: A-01-02 < A-01-10 < B-01-01. */
export const compareStorageCode = (a, b) => String(a || '').localeCompare(String(b || ''), 'vi', {
  numeric: true, sensitivity: 'base',
});

const byCode = (a, b) => compareStorageCode(a.storageCode, b.storageCode) || idOf(a.storageId).localeCompare(idOf(b.storageId));

/**
 * Gom các món available theo kệ, lấy kệ nhiều món nhất trước (cùng số món: mã kệ nhỏ trước)
 * đến khi đủ `needed`; trong một kệ lấy món theo mã hàng tăng dần.
 * @param {{ _id: string, itemCode: string, storageId: string, storageCode: string }[]} items
 * @param {number} needed
 * @returns {{ picks: { storageId, storageCode, quantity, itemIds, itemCodes }[], shortage: number }}
 */
export const suggestIndividualPicks = (items, needed) => {
  const want = positive(needed);
  if (!want) return { picks: [], shortage: 0 };
  const groups = new Map();
  for (const item of items || []) {
    const key = idOf(item.storageId);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { storageId: item.storageId, storageCode: item.storageCode, items: [] });
    groups.get(key).items.push(item);
  }
  const ordered = [...groups.values()].sort((a, b) => b.items.length - a.items.length || byCode(a, b));
  const picks = [];
  let remaining = want;
  for (const group of ordered) {
    if (!remaining) break;
    const chosen = [...group.items]
      .sort((a, b) => compareStorageCode(a.itemCode, b.itemCode) || idOf(a._id).localeCompare(idOf(b._id)))
      .slice(0, remaining);
    picks.push({
      storageId: group.storageId,
      storageCode: group.storageCode,
      quantity: chosen.length,
      itemIds: chosen.map((item) => idOf(item._id)),
      itemCodes: chosen.map((item) => item.itemCode),
    });
    remaining -= chosen.length;
  }
  return { picks: picks.sort(byCode), shortage: remaining };
};

/**
 * Gợi ý cho cả phiếu (TASK-015: mọi dòng là hàng theo món). Nếu nhiều dòng cùng một biến thể, dòng sau chỉ
 * dùng các món còn lại sau dòng trước (không gợi ý một món cho hai dòng).
 * @param {{ detailId, variantId, needed: number }[]} lines
 * @param {{ itemsByVariant: Map<string, object[]> }} pools
 */
export const buildPickSuggestion = (lines, { itemsByVariant = new Map() } = {}) => {
  const usedItems = new Set();
  return (lines || []).map((line) => {
    const variantKey = idOf(line.variantId);
    const items = (itemsByVariant.get(variantKey) || []).filter((item) => !usedItems.has(idOf(item._id)));
    const result = suggestIndividualPicks(items, line.needed);
    result.picks.forEach((pick) => pick.itemIds.forEach((id) => usedItems.add(id)));
    return { detailId: line.detailId, variantId: line.variantId, needed: positive(line.needed), ...result };
  });
};
