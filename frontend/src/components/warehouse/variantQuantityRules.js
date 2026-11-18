/**
 * Hàm thuần cho VariantQuantityPicker (TASK-014 B): sắp biến thể, kiểm số lượng, cộng dồn dòng phiếu.
 * Không dùng JSX / React để chạy được bằng node khi test.
 */

export const idOf = (value) => String(value?._id || value || '');

const SIZE_ORDER = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', 'FREESIZE', 'FREE SIZE'];
const sizeRank = (size) => {
  const text = String(size || '').trim().toUpperCase();
  const known = SIZE_ORDER.indexOf(text);
  if (known >= 0) return [0, known, ''];
  const number = Number(text);
  if (text && Number.isFinite(number)) return [1, number, ''];
  return [2, 0, text];
};

/** So sánh theo màu (chữ cái tiếng Việt) rồi size (XS < S < M < L < XL…, số tăng dần, còn lại theo chữ). */
export const compareVariants = (a, b) => {
  const color = String(a?.color || '').localeCompare(String(b?.color || ''), 'vi', { sensitivity: 'base' });
  if (color) return color;
  const [ga, na, ta] = sizeRank(a?.size);
  const [gb, nb, tb] = sizeRank(b?.size);
  return ga - gb || na - nb || ta.localeCompare(tb) || String(a?.sku || '').localeCompare(String(b?.sku || ''));
};

/** Biến thể đang hoạt động của một sản phẩm, đã sắp theo màu rồi size. */
export const variantsOfProduct = (variants = [], productId, filterVariant) => variants
  .filter((variant) => idOf(variant.productId) === idOf(productId))
  .filter((variant) => variant.isDeleted !== true && (!variant.status || variant.status === 'active'))
  .filter((variant) => !filterVariant || filterVariant(variant))
  .sort(compareVariants);

/** Danh sách sản phẩm (không trùng) lấy từ biến thể đã populate `productId`, sắp theo tên. */
export const productsOfVariants = (variants = []) => {
  const byId = new Map();
  for (const variant of variants) {
    const product = variant.productId;
    if (!product || typeof product !== 'object' || byId.has(idOf(product))) continue;
    if (product.isDeleted === true || (product.status && product.status !== 'active')) continue;
    byId.set(idOf(product), product);
  }
  return [...byId.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
};

/**
 * Lỗi của một ô số lượng ('' nếu hợp lệ). Ô trống = 0.
 * `max` (khi chặn theo tồn) là số còn được thêm (khả dụng trừ số đã có trong phiếu).
 */
export const quantityError = (raw, max = null) => {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) return 'Số lượng phải là số nguyên ≥ 0.';
  if (max != null && value > max) return `Vượt tồn khả dụng (còn thêm được ${Math.max(0, max)}).`;
  return '';
};

/** Tổng số lượng đang có trong phiếu theo biến thể: lines dạng `{ variantId, quantity }`. */
export const quantityByVariant = (lines = []) => {
  const totals = new Map();
  for (const line of lines) {
    const id = idOf(line.variantId);
    if (!id) continue;
    totals.set(id, (totals.get(id) || 0) + (Number(line.quantity) || 0));
  }
  return totals;
};

/**
 * Các dòng được chọn (số lượng > 0) từ bảng picker: `quantities` = { [variantId]: chuỗi nhập }.
 * Trả `[{ variantId, variant, quantity }]` theo thứ tự `variants`.
 */
export const pickedLines = (variants = [], quantities = {}) => variants
  .map((variant) => ({ variantId: idOf(variant), variant, quantity: Number(String(quantities[idOf(variant)] ?? '').trim() || 0) }))
  .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);

/**
 * Cộng dồn dòng mới vào danh sách dòng phiếu hiện có (giữ format dòng của từng màn).
 * - Dòng chưa chọn biến thể (dòng trống) bị bỏ.
 * - Biến thể đã có → cộng vào `quantityKey` của dòng cũ, không tạo dòng trùng.
 * - Biến thể mới → thêm dòng bằng `createLine(picked)`.
 */
export const mergeQuantityLines = (lines = [], picked = [], { quantityKey, createLine }) => {
  const result = lines.filter((line) => idOf(line.variantId));
  for (const pick of picked) {
    const index = result.findIndex((line) => idOf(line.variantId) === idOf(pick.variantId));
    if (index >= 0) {
      const current = Number(result[index][quantityKey]) || 0;
      result[index] = { ...result[index], [quantityKey]: current + pick.quantity };
    } else {
      result.push(createLine(pick));
    }
  }
  return result;
};

/** Dòng vượt tồn (khi `maxByStock`): trả `[{ variantId, quantity, stock }]`. */
export const linesOverStock = (lines = [], stock = new Map(), quantityKey = 'quantity') => {
  const totals = quantityByVariant(lines.map((line) => ({ variantId: line.variantId, quantity: line[quantityKey] })));
  return [...totals.entries()]
    .filter(([variantId, quantity]) => stock.has(variantId) && quantity > stock.get(variantId))
    .map(([variantId, quantity]) => ({ variantId, quantity, stock: stock.get(variantId) }));
};
