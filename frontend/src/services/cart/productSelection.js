const norm = value => String(value || '').trim().toLowerCase();
export const selectionImages = (product, size, color) => {
  const records = product?.imageRecords || [];
  const variant = matchVariant(product, size, color);
  const colorIds = new Set(activeVariants(product).filter(v => norm(v.color) === norm(color)).map(v => String(v._id)));
  const exact = variant ? records.filter(r => r.variantId && String(r.variantId?._id || r.variantId) === String(variant._id)) : [];
  const byColor = records.filter(r => r.variantId && colorIds.has(String(r.variantId?._id || r.variantId)));
  const common = records.filter(r => !r.variantId);
  const chosen = exact.length ? exact : byColor.length ? byColor : common;
  const urls = chosen.length ? chosen.map(r => r.imageUrl) : records.length ? [] : [...(product?.images || []), product?.image];
  return [...new Set(urls.filter(u => typeof u === 'string' && u.trim()))];
};
export const activeVariants = product => (product?.variants || []).filter(v => !v.isDeleted && norm(v.status) !== 'inactive');
/** @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-024 */
export const matchVariant = (product, size, color) => activeVariants(product).find(v => norm(v.size) === norm(size) && norm(v.color) === norm(color)) || null;
export const variantStock = (branch, variantId) => {
  const qty = branch?.variantQuantities?.[String(variantId)];
  return typeof qty === 'number' && Number.isFinite(qty) && qty >= 0 ? qty : null;
};
export const variantPricing = (product, variant) => variant?.pricing || {
  salePrice: Number(variant?.attributes?.salePrice ?? variant?.attributes?.price ?? product?.salePrice ?? product?.price ?? 0),
  rentalPricePerDay: Number(variant?.attributes?.rentalPricePerDay ?? product?.rentalPricePerDay ?? 0),
  deposit: Number(variant?.attributes?.deposit ?? product?.deposit ?? 0),
};
