/** Hàm thuần cho cây vị trí lưu trữ (Khu → Dãy → Kệ) và sức chứa tính theo cái. */

/** id của object đã populate hoặc id thô ('' nếu không có). */
export const idOf = (value) => (value && typeof value === 'object' ? value._id : value) || '';

/** Sức chứa hợp lệ (số nguyên) hoặc 0. */
export const capacityOf = (value) => {
  if (value === null || value === '') return 0;
  return Number.isInteger(Number(value)) ? Number(value) : 0;
};

/** Tổng sức chứa các vị trí con trực tiếp của `parentId` (bỏ qua `excludeId`). */
export const childCapacity = (rows, parentId, excludeId) => rows
  .filter((row) => idOf(row.parentStorageId) === parentId && row._id !== excludeId)
  .reduce((sum, row) => sum + capacityOf(row.maxCapacity), 0);
