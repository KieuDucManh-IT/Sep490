import { Category } from '../../models/masterdata/Category.js';
import { validateCategory } from '../../validations/masterdata/categoryValidation.js';
import { createCrudService } from '../../generic/crudService.js';
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export const categoryService = {
  ...createCrudService(Category, validateCategory, ['parentCategoryId']),
  list: () => Category.find().populate('parentCategoryId', 'name').sort({ name: 1 }),
  create: async (payload) => {
    const data = validateCategory(payload);
    if (data.parentCategoryId && !await Category.exists({ _id: data.parentCategoryId })) throw fail('Loại cha không tồn tại.');
    return Category.create(data);
  },
  update: async (id, payload) => {
    const category = await Category.findById(id);
    if (!category) return null;
    const data = validateCategory(payload, category.toObject());
    if (String(data.parentCategoryId || '') === String(id)) throw fail('Loại sản phẩm không thể là loại cha của chính nó.');
    if (data.parentCategoryId) {
      let parent = await Category.findById(data.parentCategoryId).select('_id parentCategoryId').lean();
      const visited = new Set();
      while (parent && !visited.has(String(parent._id))) {
        if (String(parent._id) === String(id)) throw fail('Không thể đưa loại sản phẩm vào hậu duệ của chính nó.');
        visited.add(String(parent._id));
        parent = parent.parentCategoryId ? await Category.findById(parent.parentCategoryId).select('_id parentCategoryId').lean() : null;
      }
    }
    Object.assign(category, data);
    return category.save();
  },
  remove: async (id) => {
    if (await Category.exists({ parentCategoryId: id })) throw fail('Không thể xóa loại đang có loại con.');
    const { Product } = await import('../../models/masterdata/Product.js');
    if (await Product.exists({ categoryId: id })) throw fail('Không thể xóa loại đang được sản phẩm sử dụng.');
    return Category.findByIdAndDelete(id);
  },
};
