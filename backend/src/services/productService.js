import mongoose from 'mongoose';
import { Product } from '../models/Product.js';

//duc 2026-10-15: Dùng shop cố định tạm thời cho đến khi backend có middleware phiên đăng nhập.
const DEFAULT_SHOP_ID = new mongoose.Types.ObjectId('6acf501f8818b8555c0c62c2');

//duc 2026-10-15: Chuẩn hóa lỗi nghiệp vụ để controller ánh xạ sang HTTP status phù hợp.
const serviceError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

//duc 2026-10-15: Tìm SKU trùng theo ràng buộc unique hiện có trên Product và bỏ qua sản phẩm đang cập nhật.
const assertSkuAvailable = async (sku, excludedId) => {
  const filter = { sku };
  if (excludedId) filter._id = { $ne: excludedId };
  if (await Product.exists(filter)) throw serviceError('SKU đã tồn tại', 409);
};

//duc 2026-10-15: Đảm bảo loại sản phẩm luôn có mức giá tương ứng sau khi tạo hoặc cập nhật.
const assertPricingIsValid = (product) => {
  if (['sale', 'both'].includes(product.tag) && product.salePrice == null) {
    throw serviceError('salePrice là bắt buộc với sản phẩm bán', 400);
  }
  if (['rental', 'both'].includes(product.tag) && product.rentalPricePerDay == null) {
    throw serviceError('rentalPricePerDay là bắt buộc với sản phẩm cho thuê', 400);
  }
};

//duc 2026-10-15: Lấy danh sách sản phẩm chưa xóa thuộc shop với tìm kiếm, lọc và phân trang.
export const getProducts = async ({ search, tag, status, page, limit }) => {
  const filter = { shopId: DEFAULT_SHOP_ID, isDeleted: false };
  if (tag) filter.tag = tag;
  if (status) filter.status = status;
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { sku: { $regex: escapedSearch, $options: 'i' } },
      { brand: { $regex: escapedSearch, $options: 'i' } }
    ];
  }
  const [data, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter)
  ]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

//duc 2026-10-15: Đọc sản phẩm theo cả ID và shop để shop không truy cập dữ liệu shop khác.
export const getProductById = (id) => Product.findOne({
  _id: id,
  shopId: DEFAULT_SHOP_ID,
  isDeleted: false
});

//duc 2026-10-15: Gắn shop mặc định, kiểm tra giá và lưu sản phẩm mới ở trạng thái pending.
export const createProduct = async (input) => {
  assertPricingIsValid({ tag: input.tag || 'sale', ...input });
  await assertSkuAvailable(input.sku);
  try {
    return await Product.create({ ...input, shopId: DEFAULT_SHOP_ID, status: 'pending' });
  } catch (error) {
    if (error.code === 11000) throw serviceError('SKU đã tồn tại', 409);
    throw error;
  }
};

//duc 2026-10-15: Chỉ cập nhật sản phẩm trong shop và xác thực tổ hợp tag với giá sau cập nhật.
export const updateProduct = async (id, input) => {
  const current = await Product.findOne({ _id: id, shopId: DEFAULT_SHOP_ID, isDeleted: false });
  if (!current) return null;
  const mergedProduct = { ...current.toObject(), ...input };
  assertPricingIsValid(mergedProduct);
  if (input.sku && input.sku !== current.sku) await assertSkuAvailable(input.sku, current._id);
  try {
    return await Product.findOneAndUpdate(
      { _id: id, shopId: DEFAULT_SHOP_ID, isDeleted: false },
      { $set: input },
      { new: true, runValidators: true }
    );
  } catch (error) {
    if (error.code === 11000) throw serviceError('SKU đã tồn tại', 409);
    throw error;
  }
};

//duc 2026-10-15: Đánh dấu sản phẩm đã xóa mà vẫn giữ lịch sử và liên kết đơn hàng.
export const deleteProduct = (id) => Product.findOneAndUpdate(
  { _id: id, shopId: DEFAULT_SHOP_ID, isDeleted: false },
  { $set: { isDeleted: true } },
  { new: true }
);
