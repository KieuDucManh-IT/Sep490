import mongoose from 'mongoose';
import { Product } from '../../models/masterdata/Product.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';
import { missingRequiredPrices } from './productPricing.js';
import { representativeUrlByProduct } from './productImageHelper.js';

import { appError as fail } from '../warehouse/shared/errors.js';
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TAG_LABELS = { rental: 'cho thuê', sale: 'bán', both: 'vừa thuê vừa bán' };

export const pricingService = {
  /**
   * Shop Owner lưu bảng giá (giá bán, giá thuê theo ngày, tiền cọc) cho sản phẩm.
   * Giá phải đủ theo `tag` (TASK-008); lưu xong thì sản phẩm được mở bán (`isSetPrice = true`).
   *
   * Ghi chú: trước đây có `ProductVariant.updateMany` ghi salePrice/rentalPricePerDay/depositAmount lên biến thể,
   * nhưng schema biến thể (strict) không có các field này nên thực tế không ghi gì → đã bỏ. Giá biến thể vẫn
   * đọc từ `variant.attributes` qua `resolveProductPricing`.
   *
   * @param {string} productId
   * @param {{ salePrice, rentalPricePerDay, deposit }} pricingData
   * @param {Object} [user] - req.user (Shop Owner)
   */
  updateProductPricing: async (productId, { salePrice, rentalPricePerDay, deposit }, user = null) => {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw fail('Mã định danh sản phẩm không hợp lệ.');

    const numericSalePrice = Number(salePrice ?? 0);
    const numericRentalPrice = Number(rentalPricePerDay ?? 0);
    const numericDeposit = Number(deposit ?? 0);

    if (!Number.isFinite(numericSalePrice) || numericSalePrice < 0) throw fail('Giá trị trang phục / giá bán phải là số không âm.');
    if (!Number.isFinite(numericRentalPrice) || numericRentalPrice < 0) throw fail('Giá thuê mỗi ngày phải là số không âm.');
    if (!Number.isFinite(numericDeposit) || numericDeposit < 0) throw fail('Tiền cọc bảo đảm phải là số không âm.');

    const product = await Product.findById(productId);
    if (!product || product.isDeleted) throw fail('Không tìm thấy sản phẩm hoặc sản phẩm đã bị xóa.', 404);

    const missing = missingRequiredPrices({
      tag: product.tag,
      salePrice: numericSalePrice,
      rentalPricePerDay: numericRentalPrice,
      deposit: numericDeposit,
    });
    if (missing.length) {
      const tagLabel = TAG_LABELS[String(product.tag || '').toLowerCase()] || 'chưa xác định hình thức';
      throw fail(`Sản phẩm ${tagLabel} còn thiếu: ${missing.join(', ')}.`);
    }

    product.salePrice = numericSalePrice;
    product.rentalPricePerDay = numericRentalPrice;
    product.deposit = numericDeposit;
    product.isSetPrice = true;
    product.priceSetBy = user?._id || null;
    product.priceSetAt = new Date();
    await product.save();

    return { product };
  },

  /**
   * Danh sách sản phẩm cho trang định giá của Shop Owner: gồm cả sản phẩm chưa định giá (vẫn lọc isDeleted).
   * Query: pricingStatus=unset|set|all (mặc định all), search, page, limit.
   */
  listOwnerPricingProducts: async ({ pricingStatus = 'all', search = '', page = 1, limit = 20 } = {}) => {
    const status = ['unset', 'set', 'all'].includes(String(pricingStatus)) ? String(pricingStatus) : 'all';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));

    const base = () => {
      const filter = { isDeleted: { $ne: true } };
      const keyword = typeof search === 'string' ? search.trim() : '';
      if (keyword) {
        const regex = new RegExp(escapeRegex(keyword), 'i');
        filter.$or = [{ name: regex }, { productCode: regex }, { brand: regex }];
      }
      return filter;
    };
    const query = base();
    if (status === 'set') query.isSetPrice = true;
    if (status === 'unset') query.isSetPrice = { $ne: true };

    const [products, total, unsetCount, setCount] = await Promise.all([
      Product.find(query)
        .select('name productCode tag status brand categoryId salePrice rentalPricePerDay deposit discount isSetPrice priceSetBy priceSetAt image images createdAt updatedAt')
        .populate('categoryId', 'name')
        .sort({ isSetPrice: 1, createdAt: -1, _id: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query),
      Product.countDocuments({ ...base(), isSetPrice: { $ne: true } }),
      Product.countDocuments({ ...base(), isSetPrice: true }),
    ]);

    const images = products.length ? await ProductImage.find({ productId: { $in: products.map((p) => p._id) } }).lean() : [];
    const imageByProduct = representativeUrlByProduct(images);

    const data = products.map((product) => {
      const legacy = (Array.isArray(product.images) ? product.images.find((url) => typeof url === 'string' && url.trim()) : '') || product.image || '';
      const image = imageByProduct.get(String(product._id)) || legacy;
      return {
        ...product,
        isSetPrice: product.isSetPrice === true,
        priceSetAt: product.priceSetAt || null,
        salePrice: Number(product.salePrice || 0),
        rentalPricePerDay: Number(product.rentalPricePerDay || 0),
        deposit: Number(product.deposit || 0),
        categoryName: Array.isArray(product.categoryId) ? product.categoryId.map((c) => c?.name).filter(Boolean).join(', ') : '',
        image,
        images: image ? [image] : [],
        missingPrices: missingRequiredPrices(product),
      };
    });

    return {
      data,
      counts: { unset: unsetCount, set: setCount, all: unsetCount + setCount },
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) || 1 },
    };
  },
};
