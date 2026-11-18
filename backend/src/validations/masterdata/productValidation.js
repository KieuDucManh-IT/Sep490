import { validateInput } from '../../generic/inputValidation.js';
import mongoose from 'mongoose';

const fields = [
  'productCode',
  'name',
  'description',
  'tag',
  'trackingType',
  'brand',
  'material',
  'rating',
  'reviewsCount',
  'aiTryOn',
  'gender',
  'status',
  'isDeleted',
  'shopId',
];

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
  aiTryOn: { label: 'Hỗ trợ thử đồ AI', type: 'boolean' },
  gender: { label: 'Giới tính', type: 'string', maxLength: 80 },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive', 'discontinued'] },
  isDeleted: { label: 'Trạng thái xóa', type: 'boolean' },
  shopId: { label: 'Gian hàng', type: 'objectId', nullable: true },
};

// TASK-008: giá và trạng thái định giá chỉ do Shop Owner đặt qua PATCH /api/products/:id/pricing.
// API masterdata (Quản lý kho) bỏ qua các field này: không ghi, không báo lỗi.
export const OWNER_ONLY_PRODUCT_FIELDS = ['rentalPricePerDay', 'salePrice', 'deposit', 'discount', 'isSetPrice', 'priceSetBy', 'priceSetAt'];

export const validateProduct = (payload, current) => {
  const { categoryId, ...rawPayload } = payload || {};
  const productPayload = Object.fromEntries(Object.entries(rawPayload).filter(([key]) => !OWNER_ONLY_PRODUCT_FIELDS.includes(key)));
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
  return normalized;
};
