import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { ProductVariant } from '../models/ProductVariant.js';

//duc 2026-10-15: Cố định shop sở hữu product trong lúc chưa có middleware lấy shop từ phiên đăng nhập.
const DEFAULT_SHOP_ID = new mongoose.Types.ObjectId('6acf501f8818b8555c0c62c2');

//duc 2026-10-15: Xác nhận product còn hoạt động và thuộc shop trước mọi thao tác variant.
const productExistsForShop = (productId) => Product.exists({
  _id: productId,
  shopId: DEFAULT_SHOP_ID,
  isDeleted: false
});

//duc 2026-10-15: Lấy tất cả variant chưa xóa của product thuộc shop hiện tại.
export const getProductVariants = async (productId) => {
  if (!await productExistsForShop(productId)) return null;
  return ProductVariant.find({ productId, isDeleted: false }).sort({ createdAt: -1 });
};

//duc 2026-10-15: Đọc một variant khi product cha thuộc shop và variant chưa bị xóa.
export const getProductVariantById = async (productId, variantId) => {
  if (!await productExistsForShop(productId)) return null;
  return ProductVariant.findOne({ _id: variantId, productId, isDeleted: false });
};

//duc 2026-10-15: Tạo variant gắn với product đã xác minh quyền sở hữu shop.
export const createProductVariant = async (productId, input) => {
  if (!await productExistsForShop(productId)) return null;
  return ProductVariant.create({ ...input, productId });
};

//duc 2026-10-15: Cập nhật variant trong product được shop sở hữu, chấp nhận payload rỗng.
export const updateProductVariant = async (productId, variantId, input) => {
  if (!await productExistsForShop(productId)) return null;
  return ProductVariant.findOneAndUpdate(
    { _id: variantId, productId, isDeleted: false },
    { $set: input },
    { new: true, runValidators: true }
  );
};

//duc 2026-10-15: Xóa mềm variant để giữ lại dữ liệu sản phẩm đã từng được bán hoặc cho thuê.
export const deleteProductVariant = async (productId, variantId) => {
  if (!await productExistsForShop(productId)) return null;
  return ProductVariant.findOneAndUpdate(
    { _id: variantId, productId, isDeleted: false },
    { $set: { isDeleted: true } },
    { new: true }
  );
};
