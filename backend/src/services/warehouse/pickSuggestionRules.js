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
 * Hàng quản lý theo số lượng.
 * 1. Có kệ đủ `needed` → chọn 1 kệ đủ hàng có mã nhỏ nhất.
 * 2. Không có → tham lam theo khả dụng giảm dần (cùng khả dụng: mã nhỏ trước) đến khi đủ → ít kệ nhất.
 * @param {{ storageId: string, storageCode: string, available: number }[]} shelves
 * @param {number} needed
 * @returns {{ picks: { storageId, storageCode, quantity }[], shortage: number }} picks sắp theo mã vị trí
 */
export const suggestQuantityPicks = (shelves, needed) => {
  const want = positive(needed);
  const usable = (shelves || [])
    .map((shelf) => ({ ...shelf, available: positive(shelf.available) }))
    .filter((shelf) => shelf.available > 0)
    .sort(byCode);
  if (!want) return { picks: [], shortage: 0 };
  const single = usable.find((shelf) => shelf.available >= want);
  if (single) return { picks: [{ storageId: single.storageId, storageCode: single.storageCode, quantity: want }], shortage: 0 };
  const picks = [];
  let remaining = want;
  for (const shelf of [...usable].sort((a, b) => b.available - a.available || byCode(a, b))) {
    if (!remaining) break;
    const quantity = Math.min(shelf.available, remaining);
    picks.push({ storageId: shelf.storageId, storageCode: shelf.storageCode, quantity });
    remaining -= quantity;
  }
  return { picks: picks.sort(byCode), shortage: remaining };
};

/**
 * Hàng quản lý từng món: gom các món available theo kệ, lấy kệ nhiều món nhất trước (cùng số món: mã kệ nhỏ trước)
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
 * Gợi ý cho cả phiếu. Nếu nhiều dòng cùng một biến thể, dòng sau chỉ dùng phần còn lại sau dòng trước
 * (không gợi ý một món / một phần tồn cho hai dòng).
 * @param {{ detailId, variantId, individual: boolean, needed: number }[]} lines
 * @param {{ shelvesByVariant: Map<string, object[]>, itemsByVariant: Map<string, object[]> }} pools
 */
export const buildPickSuggestion = (lines, { shelvesByVariant = new Map(), itemsByVariant = new Map() } = {}) => {
  const usedQuantity = new Map(); // `${variantId}:${storageId}` → đã gợi ý
  const usedItems = new Set();
  return (lines || []).map((line) => {
    const variantKey = idOf(line.variantId);
    let result;
    if (line.individual) {
      const items = (itemsByVariant.get(variantKey) || []).filter((item) => !usedItems.has(idOf(item._id)));
      result = suggestIndividualPicks(items, line.needed);
      result.picks.forEach((pick) => pick.itemIds.forEach((id) => usedItems.add(id)));
    } else {
      const shelves = (shelvesByVariant.get(variantKey) || []).map((shelf) => ({
        ...shelf,
        available: positive(shelf.available) - (usedQuantity.get(`${variantKey}:${idOf(shelf.storageId)}`) || 0),
      }));
      result = suggestQuantityPicks(shelves, line.needed);
      for (const pick of result.picks) {
        const key = `${variantKey}:${idOf(pick.storageId)}`;
        usedQuantity.set(key, (usedQuantity.get(key) || 0) + pick.quantity);
      }
    }
    return { detailId: line.detailId, variantId: line.variantId, needed: positive(line.needed), ...result };
  });
};
