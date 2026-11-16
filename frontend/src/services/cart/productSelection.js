const norm = value => String(value || '').trim().toLowerCase();
const byPrimaryThenOrder = (a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary))
  || (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0);
/**
 * Ảnh theo màu (TASK-007): ảnh của màu đang chọn → ảnh chung (color null) → product.images/product.image.
 * `size` giữ lại để không phải sửa nơi gọi; ảnh dùng chung cho mọi size của một màu.
 */
export const selectionImages = (product, size, color) => {
  const records = product?.imageRecords || [];
  const byColor = norm(color) ? records.filter(r => r.color && norm(r.color) === norm(color)) : [];
  const common = records.filter(r => !r.color);
  const chosen = (byColor.length ? byColor : common).slice().sort(byPrimaryThenOrder);
  const urls = chosen.length ? chosen.map(r => r.imageUrl) : [...(product?.images || []), product?.image];
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
