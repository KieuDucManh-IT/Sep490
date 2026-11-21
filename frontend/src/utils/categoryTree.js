/**
 * Hàm thuần cho danh mục tối đa 2 cấp (TASK-014 A3), cùng quy tắc với backend
 * `services/masterdata/categoryRules.js`. Không dùng JSX để chạy được bằng node khi test.
 */

export const categoryIdOf = (value) => String(value?._id || value || '');

/** Loại cấp 1 = không có loại cha. */
export const isRootCategory = (category) => !categoryIdOf(category?.parentCategoryId);

const isActive = (category) => category?.status === 'active' && category?.isDeleted !== true;

/** Ô "Loại cha": loại cấp 1, đang hoạt động, khác chính nó. */
export const selectableParents = (categories = [], currentId = null) => categories
  .filter((category) => isRootCategory(category) && isActive(category) && categoryIdOf(category) !== categoryIdOf(currentId));

/** Có loại con (chưa xóa) hay không. */
export const hasChildCategories = (categories = [], id) => categories
  .some((category) => category?.isDeleted !== true && categoryIdOf(category.parentCategoryId) === categoryIdOf(id));

/** Cấp hiển thị (1, 2, 3…) tính theo số tầng cha; dữ liệu cũ có thể còn cấp 3. */
export const categoryDepth = (category, categories = []) => {
  const byId = new Map(categories.map((item) => [categoryIdOf(item), item]));
  let depth = 1;
  let parentId = categoryIdOf(category?.parentCategoryId);
  const seen = new Set([categoryIdOf(category)]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    depth += 1;
    parentId = categoryIdOf(byId.get(parentId)?.parentCategoryId);
  }
  return depth;
};

/** Nhãn "Cha › Con" (loại cấp 1 chỉ hiện tên). */
export const categoryPathLabel = (category, categories = []) => {
  const byId = new Map(categories.map((item) => [categoryIdOf(item), item]));
  const names = [category?.name];
  let parentId = categoryIdOf(category?.parentCategoryId);
  const seen = new Set([categoryIdOf(category)]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const populated = typeof category?.parentCategoryId === 'object' && categoryIdOf(category.parentCategoryId) === parentId;
    const parent = byId.get(parentId) || (populated ? category.parentCategoryId : null);
    if (!parent?.name) break;
    names.unshift(parent.name);
    parentId = categoryIdOf(parent.parentCategoryId);
  }
  return names.filter(Boolean).join(' › ');
};

/** Loại cấp cuối = đang hoạt động và không có loại con đang hoạt động. Sản phẩm chỉ gắn được các loại này. */
export const leafCategories = (categories = []) => {
  const activeParents = new Set(categories
    .filter((category) => isActive(category) && !isRootCategory(category))
    .map((category) => categoryIdOf(category.parentCategoryId)));
  return categories.filter((category) => isActive(category) && !activeParents.has(categoryIdOf(category)));
};

/**
 * Lựa chọn cho ô "Loại sản phẩm" của sản phẩm: loại cấp cuối dạng "Cha › Con", sắp theo nhãn.
 * Loại đang gắn sẵn nhưng không còn là cấp cuối (dữ liệu cũ) vẫn hiện, kèm ghi chú, để không mất lựa chọn.
 */
export const productCategoryOptions = (categories = [], selectedIds = []) => {
  const leaves = leafCategories(categories);
  const leafIds = new Set(leaves.map(categoryIdOf));
  const options = leaves.map((category) => ({ value: categoryIdOf(category), label: categoryPathLabel(category, categories) }));
  for (const id of selectedIds.map(categoryIdOf)) {
    if (leafIds.has(id)) continue;
    const category = categories.find((item) => categoryIdOf(item) === id);
    if (category) options.push({ value: id, label: `${categoryPathLabel(category, categories)} (không phải loại cấp cuối)` });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
};
