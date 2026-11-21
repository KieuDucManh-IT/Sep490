// Quy tắc danh mục 2 cấp (TASK-014 A3) — hàm thuần, không đụng DB để unit test chạy độc lập.
// Cấp 1 = loại không có cha. Cấp 2 = loại có cha là loại cấp 1. Không cho tạo cấp 3.
// Sản phẩm chỉ gắn loại "cấp cuối" = loại không có loại con đang hoạt động.

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });
const idOf = (value) => String(value?._id || value || '');

export const PARENT_MUST_BE_ROOT = 'Chỉ được chọn loại cấp 1 làm loại cha.';
export const PARENT_HAS_CHILDREN = 'Loại đang có loại con nên không thể chọn loại cha (danh mục tối đa 2 cấp).';
export const PRODUCT_NEEDS_LEAF = 'Sản phẩm chỉ được gắn loại cấp cuối (loại không có loại con).';

/**
 * Kiểm tra loại cha khi tạo/sửa danh mục và trả về cấp (`lv1` | `lv2`) để lưu vào field `type`.
 * - `parent`: document loại cha (null nếu không chọn cha).
 * - `hasChildren`: loại đang sửa có loại con chưa xóa.
 * - `currentId`: id loại đang sửa (null khi tạo).
 */
export const resolveCategoryLevel = ({ parent = null, hasChildren = false, currentId = null } = {}) => {
  if (!parent) return 'lv1';
  if (currentId && idOf(parent) === idOf(currentId)) throw badRequest('Loại sản phẩm không thể là loại cha của chính nó.');
  if (parent.parentCategoryId) throw badRequest(PARENT_MUST_BE_ROOT);
  if (hasChildren) throw badRequest(PARENT_HAS_CHILDREN);
  return 'lv2';
};

/** Loại có thể chọn làm cha trên form: cấp 1, đang hoạt động, chưa xóa, khác chính nó. */
export const isSelectableParent = (category, currentId = null) => Boolean(category
  && !category.parentCategoryId
  && category.status === 'active'
  && category.isDeleted !== true
  && idOf(category) !== idOf(currentId));

/**
 * Trả về các id loại KHÔNG phải cấp cuối trong `categoryIds`.
 * `activeChildParentIds`: tập id cha của mọi loại con đang hoạt động (chưa xóa).
 */
export const nonLeafCategoryIds = (categoryIds = [], activeChildParentIds = []) => {
  const parents = new Set([...activeChildParentIds].map(idOf));
  return [...new Set(categoryIds.map(idOf))].filter((id) => parents.has(id));
};

/** Ném 400 nếu có loại không phải cấp cuối. */
export const assertLeafCategories = (categoryIds, activeChildParentIds) => {
  if (nonLeafCategoryIds(categoryIds, activeChildParentIds).length) throw badRequest(PRODUCT_NEEDS_LEAF);
};

/**
 * Báo cáo độ sâu cho script kiểm tra: loại sâu hơn 2 cấp (depth ≥ 3) và sản phẩm gắn loại không phải cấp cuối.
 * `categories`: [{ _id, name, parentCategoryId, status, isDeleted }]; `products`: [{ _id, productCode, name, categoryId }].
 */
export const categoryDepthReport = (categories = [], products = []) => {
  const live = categories.filter((category) => category.isDeleted !== true);
  const byId = new Map(live.map((category) => [idOf(category), category]));
  const depthOf = (category) => {
    let depth = 1;
    let parentId = idOf(category.parentCategoryId);
    const seen = new Set([idOf(category)]);
    while (parentId && byId.has(parentId) && !seen.has(parentId)) {
      seen.add(parentId);
      depth += 1;
      parentId = idOf(byId.get(parentId).parentCategoryId);
    }
    return depth;
  };
  const tooDeep = live.map((category) => ({ category, depth: depthOf(category) })).filter((row) => row.depth > 2);
  const activeChildParentIds = live.filter((category) => category.status === 'active' && category.parentCategoryId)
    .map((category) => idOf(category.parentCategoryId));
  const productsOnNonLeaf = products
    .map((product) => {
      const ids = Array.isArray(product.categoryId) ? product.categoryId : [product.categoryId].filter(Boolean);
      return { product, categoryIds: nonLeafCategoryIds(ids, activeChildParentIds) };
    })
    .filter((row) => row.categoryIds.length);
  return { tooDeep, productsOnNonLeaf };
};
