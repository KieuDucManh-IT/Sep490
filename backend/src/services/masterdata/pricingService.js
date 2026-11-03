import mongoose from 'mongoose';
import { Product } from '../../models/masterdata/Product.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';

export const pricingService = {
  /**
   * Cập nhật bảng giá (giá bán, giá thuê theo ngày, tiền cọc) cho sản phẩm cha
   * và tự động cascade đồng bộ sang toàn bộ ProductVariant trực thuộc.
   *
   * @param {string} productId - Mã ID của sản phẩm
   * @param {Object} pricingData - Dữ liệu bảng giá { salePrice, rentalPricePerDay, deposit }
   * @returns {Promise<{ product: Object, syncedVariantsCount: number }>}
   */
  updateProductPricing: async (productId, { salePrice, rentalPricePerDay, deposit }) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const err = new Error('Mã định danh sản phẩm không hợp lệ.');
      err.statusCode = 400;
      throw err;
    }

    const numericSalePrice = Number(salePrice);
    const numericRentalPrice = Number(rentalPricePerDay);
    const numericDeposit = Number(deposit);

    if (isNaN(numericSalePrice) || numericSalePrice < 0) {
      const err = new Error('Giá trị trang phục / giá bán phải là số không âm.');
      err.statusCode = 400;
      throw err;
    }

    if (isNaN(numericRentalPrice) || numericRentalPrice < 0) {
      const err = new Error('Giá thuê mỗi ngày phải là số không âm.');
      err.statusCode = 400;
      throw err;
    }

    if (isNaN(numericDeposit) || numericDeposit < 0) {
      const err = new Error('Tiền cọc bảo đảm phải là số không âm.');
      err.statusCode = 400;
      throw err;
    }

    const product = await Product.findById(productId);
    if (!product || product.isDeleted) {
      const err = new Error('Không tìm thấy sản phẩm hoặc sản phẩm đã bị xóa.');
      err.statusCode = 404;
      throw err;
    }

    // 1. Cập nhật bảng giá trên Sản phẩm cha
    product.salePrice = numericSalePrice;
    product.rentalPricePerDay = numericRentalPrice;
    product.deposit = numericDeposit;
    await product.save();

    // 2. Cascade đồng bộ sang tất cả ProductVariant trực thuộc
    const variantUpdateResult = await ProductVariant.updateMany(
      { productId: product._id },
      {
        $set: {
          salePrice: numericSalePrice,
          rentalPricePerDay: numericRentalPrice,
          depositAmount: numericDeposit,
        },
      }
    );

    const syncedVariantsCount =
      variantUpdateResult.modifiedCount ?? variantUpdateResult.nModified ?? 0;

    return {
      product,
      syncedVariantsCount,
    };
  },
};
