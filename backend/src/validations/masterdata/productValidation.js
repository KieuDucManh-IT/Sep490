import { validateInput } from '../../generic/inputValidation.js';
import mongoose from 'mongoose';

const fields = ['productCode', 'name', 'description', 'tag', 'trackingType', 'brand', 'material', 'rating', 'reviewsCount', 'rentalPricePerDay', 'salePrice', 'deposit', 'discount', 'aiTryOn', 'gender', 'status', 'isDeleted'];
const rules = {
  productCode: { label: 'Mã sản phẩm', type: 'string', required: true, maxLength: 80 },
  name: { label: 'Tên sản phẩm', type: 'string', required: true, maxLength: 200 },
  description: { label: 'Mô tả', type: 'string', maxLength: 2000 },
  tag: { label: 'Hình thức sản phẩm', type: 'string', enum: ['sale', 'rental', 'both'] },
  trackingType: { label: 'Kiểu theo dõi', type: 'string', required: true, enum: ['quantity', 'individual'] },
  brand: { label: 'Thương hiệu', type: 'string', maxLength: 120 },
  material: { label: 'Chất liệu', type: 'string', maxLength: 200 },
  rating: { label: 'Đánh giá', type: 'number', min: 0 },
  reviewsCount: { label: 'Số lượt đánh giá', type: 'number', min: 0, integer: true },
  rentalPricePerDay: { label: 'Giá thuê mỗi ngày', type: 'number', min: 0 },
  salePrice: { label: 'Giá bán', type: 'number', min: 0 },
  deposit: { label: 'Tiền cọc', type: 'number', min: 0 },
  discount: { label: 'Giảm giá', type: 'number', min: 0 },
  aiTryOn: { label: 'Hỗ trợ thử đồ AI', type: 'boolean' },
  gender: { label: 'Giới tính', type: 'string', maxLength: 80 },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive', 'discontinued'] },
  isDeleted: { label: 'Trạng thái xóa', type: 'boolean' },
};
export const validateProduct = (payload, current) => {
  const { categoryId, ...productPayload } = payload || {};
  const { categoryId: currentCategoryIds, ...currentProduct } = current || {};
  const normalized = validateInput(productPayload, currentProduct, fields, rules);
  const categories = categoryId === undefined ? currentCategoryIds : categoryId;
  const categoryIds = Array.isArray(categories) ? categories : categories == null ? [] : [categories];
  if (!categoryIds.length) throw Object.assign(new Error('Cần chọn ít nhất một loại sản phẩm.'), { statusCode: 400 });
  const normalizedCategoryIds = categoryIds.map((value) => {
    const id = typeof value === 'string' ? value : value?._id?.toString?.() || value?.toString?.();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) throw Object.assign(new Error('Mã loại sản phẩm không hợp lệ.'), { statusCode: 400 });
    return id;
  });
  if (new Set(normalizedCategoryIds).size !== normalizedCategoryIds.length) {
    throw Object.assign(new Error('Không được chọn trùng loại sản phẩm.'), { statusCode: 400 });
  }
  normalized.categoryId = normalizedCategoryIds;
  if (normalized.rating != null && normalized.rating > 5) throw Object.assign(new Error('Đánh giá không được lớn hơn 5.'), { statusCode: 400 });
  if (normalized.discount != null && normalized.discount > 100) throw Object.assign(new Error('Giảm giá không được lớn hơn 100%.'), { statusCode: 400 });
  return normalized;
};
