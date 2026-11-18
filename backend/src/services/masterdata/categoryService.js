import { Category } from '../../models/masterdata/Category.js';
import { validateCategory } from '../../validations/masterdata/categoryValidation.js';
import { createCrudService } from '../../generic/crudService.js';
import { appError as fail } from '../warehouse/shared/errors.js';
import { resolveCategoryLevel } from './categoryRules.js';

export const categoryService = {
  ...createCrudService(Category, validateCategory, ['parentCategoryId']),
  list: async () => {
    const rows = await Category.find({ isDeleted: { $ne: true } }).populate('parentCategoryId', 'name type parentCategoryId').sort({ name: 1 }).lean();
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    const inferType = (row, seen = new Set()) => {
      if (['lv1', 'lv2', 'lv3'].includes(row.type)) return row.type;
      if (seen.has(String(row._id))) return 'lv1';
      seen.add(String(row._id));
      const parent = byId.get(String(row.parentCategoryId?._id || row.parentCategoryId || ''));
      if (!parent) return 'lv1';
      return inferType(parent, seen) === 'lv1' ? 'lv2' : 'lv3';
    };
    return rows.map((row) => ({ ...row, type: inferType(row) }));
  },
  // Danh mục tối đa 2 cấp (TASK-014 A3): cấp (`type`) do server tính từ loại cha, bỏ qua `type` client gửi.
  create: async (payload) => {
    const data = validateCategory({ ...(payload || {}), type: 'lv1' });
    const parent = await findParent(data.parentCategoryId);
    data.type = resolveCategoryLevel({ parent });
    return Category.create(data);
  },
  update: async (id, payload) => {
    const category = await Category.findById(id);
    if (!category) return null;
    const legacyType = category.type || await inferCategoryType(category);
    const data = validateCategory({ ...(payload || {}), type: legacyType }, { ...category.toObject(), type: legacyType });
    const nextParentId = Object.hasOwn(data, 'parentCategoryId') ? data.parentCategoryId : category.parentCategoryId;
    // Chỉ kiểm tra cấp khi đổi loại cha: loại cấp 3 cũ vẫn sửa được tên / trạng thái để dọn dữ liệu.
    if (String(nextParentId || '') !== String(category.parentCategoryId || '')) {
      const parent = await findParent(nextParentId);
      const hasChildren = parent
        ? Boolean(await Category.exists({ parentCategoryId: id, isDeleted: { $ne: true } }))
        : false;
      data.type = resolveCategoryLevel({ parent, hasChildren, currentId: id });
    }
    Object.assign(category, data);
    return category.save();
  },
  remove: async (id) => {
    if (await Category.exists({ parentCategoryId: id, isDeleted: { $ne: true } })) throw fail('Không thể xóa loại đang có loại con.');
    const { Product } = await import('../../models/masterdata/Product.js');
    if (await Product.exists({ categoryId: id, isDeleted: { $ne: true } })) throw fail('Không thể xóa loại đang được sản phẩm sử dụng.');
    return Category.findByIdAndUpdate(id, { $set: { isDeleted: true, status: 'inactive' } }, { new: true });
  },
};

/** Cấp của loại cũ chưa lưu `type` (đếm số tầng cha, tối đa 3). */
const inferCategoryType = async (category) => {
  if (category.type) return category.type;
  let depth = 0;
  let parentId = category.parentCategoryId;
  const visited = new Set([String(category._id)]);
  while (parentId && depth < 2) {
    const parent = await Category.findById(parentId).select('parentCategoryId').lean();
    if (!parent || visited.has(String(parent._id))) break;
    visited.add(String(parent._id)); depth += 1; parentId = parent.parentCategoryId;
  }
  return ['lv1', 'lv2', 'lv3'][Math.min(depth, 2)];
};

const findParent = async (parentCategoryId) => {
  if (!parentCategoryId) return null;
  const parent = await Category.findOne({ _id: parentCategoryId, isDeleted: { $ne: true } }).select('_id parentCategoryId status').lean();
  if (!parent) throw fail('Loại cha không tồn tại hoặc đã bị xóa.');
  return parent;
};
