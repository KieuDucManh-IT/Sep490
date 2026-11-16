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
