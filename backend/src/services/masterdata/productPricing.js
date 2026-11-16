/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-028 */
export const resolveProductPricing = (product = {}, variant = {}) => ({
  salePrice: Number(variant.attributes?.salePrice ?? variant.attributes?.price ?? product.salePrice ?? product.price ?? 0),
  rentalPricePerDay: Number(variant.attributes?.rentalPricePerDay ?? product.rentalPricePerDay ?? 0),
  deposit: Number(variant.attributes?.deposit ?? product.deposit ?? 0),
});

export const isActiveProduct = (product) => Boolean(product && product.isDeleted !== true &&
  !['inactive', 'discontinued'].includes(String(product.status || '').toLowerCase()));

export const isActiveVariant = (variant) => Boolean(variant && variant.isDeleted !== true &&
  String(variant.status || '').toLowerCase() !== 'inactive');

// TASK-008 — Sản phẩm chỉ hiện cho khách sau khi Shop Owner định giá.
const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const nonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

/**
 * Danh sách giá còn thiếu theo `tag`:
 * - rental: rentalPricePerDay > 0, deposit ≥ 0
 * - sale:   salePrice > 0
 * - both:   rentalPricePerDay > 0 và salePrice > 0 (deposit ≥ 0)
 * - chưa có tag: cần ít nhất một trong hai giá > 0
 */
export const missingRequiredPrices = (product = {}) => {
  const tag = String(product?.tag || '').toLowerCase();
  const missing = [];
  const needRental = tag === 'rental' || tag === 'both';
  const needSale = tag === 'sale' || tag === 'both';
  if (needRental && !positive(product.rentalPricePerDay)) missing.push('giá thuê mỗi ngày (> 0)');
  if (needRental && !nonNegative(product.deposit ?? 0)) missing.push('tiền cọc (≥ 0)');
  if (needSale && !positive(product.salePrice)) missing.push('giá bán (> 0)');
  if (!needRental && !needSale && !positive(product.rentalPricePerDay) && !positive(product.salePrice)) {
    missing.push('giá thuê mỗi ngày hoặc giá bán (> 0)');
  }
  return missing;
};

export const hasRequiredPrices = (product) => Boolean(product) && missingRequiredPrices(product).length === 0;

export const isCustomerVisibleProduct = (product) => isActiveProduct(product) && product.isSetPrice === true;

/**
 * Điều kiện Mongo dùng chung cho mọi truy vấn sản phẩm khách nhìn thấy.
 * Dùng hàm (trả object mới mỗi lần) khi đưa vào query, vì Mongoose có thể sửa filter tại chỗ khi cast.
 */
export const customerVisibleProductFilter = () => ({
  isDeleted: { $ne: true },
  status: { $nin: ['inactive', 'INACTIVE', 'discontinued', 'DISCONTINUED'] },
  isSetPrice: true,
});

export const CUSTOMER_VISIBLE_PRODUCT_FILTER = Object.freeze(customerVisibleProductFilter());
