import { Category } from '../../models/masterdata/Category.js';
import { validateCategory } from '../../validations/masterdata/categoryValidation.js';
import { createCrudService } from '../../generic/crudService.js';
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
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
  create: async (payload) => {
    const data = validateCategory(payload);
    await assertHierarchy(data.type, data.parentCategoryId);
    return Category.create(data);
  },
  update: async (id, payload) => {
    const category = await Category.findById(id);
    if (!category) return null;
    const legacyType = category.type || await inferCategoryType(category);
    const data = validateCategory(payload, { ...category.toObject(), type: legacyType });
    if (String(data.parentCategoryId || '') === String(id)) throw fail('Loại sản phẩm không thể là loại cha của chính nó.');
    await assertHierarchy(data.type, data.parentCategoryId, id);
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

const assertHierarchy = async (type, parentCategoryId, currentId = null) => {
  if (type === 'lv1' && parentCategoryId) throw fail('Danh mục cấp 1 không được có danh mục cha.');
  if (type !== 'lv1' && !parentCategoryId) throw fail('Danh mục cấp 2 và cấp 3 phải chọn danh mục cha.');
  if (currentId) {
    const children = await Category.find({ parentCategoryId: currentId, isDeleted: { $ne: true } }).select('type').lean();
    const expectedChildType = type === 'lv1' ? 'lv2' : type === 'lv2' ? 'lv3' : null;
    if (children.length && (!expectedChildType || children.some((child) => child.type && child.type !== expectedChildType))) {
      throw fail('Không thể đổi cấp danh mục vì cấp của danh mục con sẽ không còn hợp lệ.');
    }
  }
  if (!parentCategoryId) return;
  const parent = await Category.findOne({ _id: parentCategoryId, isDeleted: { $ne: true } }).select('_id type parentCategoryId').lean();
  if (!parent) throw fail('Loại cha không tồn tại hoặc đã bị xóa.');
  const parentType = parent.type || await inferCategoryType(parent);
  const expectedParent = type === 'lv2' ? 'lv1' : 'lv2';
  if (parentType !== expectedParent) throw fail(`${type === 'lv2' ? 'Danh mục cấp 2' : 'Danh mục cấp 3'} chỉ được nằm dưới ${expectedParent === 'lv1' ? 'danh mục cấp 1' : 'danh mục cấp 2'}.`);
  if (currentId && String(parent._id) === String(currentId)) throw fail('Loại sản phẩm không thể là loại cha của chính nó.');
  if (currentId) {
    let ancestor = parent;
    const visited = new Set();
    while (ancestor && !visited.has(String(ancestor._id))) {
      if (String(ancestor._id) === String(currentId)) throw fail('Không thể đưa loại sản phẩm vào hậu duệ của chính nó.');
      visited.add(String(ancestor._id));
      ancestor = ancestor.parentCategoryId ? await Category.findById(ancestor.parentCategoryId).select('_id type parentCategoryId').lean() : null;
    }
  }
};
