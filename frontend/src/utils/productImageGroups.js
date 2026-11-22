/**
 * Hàm thuần cho ảnh sản phẩm theo nhóm (TASK-014 A4): "Ảnh chung" (color null) và từng màu biến thể.
 * Ảnh giữ trong một mảng phẳng; thứ tự trong mảng (lọc theo nhóm) = thứ tự hiển thị của nhóm.
 */

export const PRODUCT_SCOPE = '__product__';
export const colorKey = (value) => String(value || '').trim().toLowerCase();
export const imageScope = (image) => colorKey(image?.color) || PRODUCT_SCOPE;

/** Danh sách nhóm theo thứ tự: Ảnh chung, các màu biến thể, rồi màu cũ không còn biến thể. */
export const imageGroups = (images = [], colorOptions = []) => {
  const groups = [{ scope: PRODUCT_SCOPE, color: null, label: 'Ảnh chung', orphan: false }];
  const seen = new Set([PRODUCT_SCOPE]);
  for (const color of colorOptions) {
    const scope = colorKey(color);
    if (!scope || seen.has(scope)) continue;
    seen.add(scope);
    groups.push({ scope, color, label: `Màu: ${color}`, orphan: false });
  }
  for (const image of images) {
    const scope = imageScope(image);
    if (seen.has(scope)) continue;
    seen.add(scope);
    groups.push({ scope, color: String(image.color).trim(), label: `Màu: ${String(image.color).trim()} (không còn biến thể)`, orphan: true });
  }
  return groups.map((group) => ({ ...group, images: images.filter((image) => imageScope(image) === group.scope) }));
};

/** Đổi chỗ ảnh `index` với ảnh liền trước (`-1`) / liền sau (`+1`) CÙNG nhóm. */
export const moveImageInGroup = (images, index, direction) => {
  const scope = imageScope(images[index]);
  const sameScope = images.map((image, position) => ({ image, position })).filter(({ image }) => imageScope(image) === scope);
  const at = sameScope.findIndex(({ position }) => position === index);
  const target = sameScope[at + direction];
  if (at < 0 || !target) return images;
  const next = [...images];
  [next[index], next[target.position]] = [next[target.position], next[index]];
  return next;
};

/** Mỗi nhóm đúng một ảnh đại diện: giữ ảnh đã chọn đầu tiên, nhóm chưa có thì lấy ảnh đầu tiên của nhóm. */
export const ensureOnePrimary = (images) => {
  const primaryOf = new Map();
  images.forEach((image, index) => {
    const scope = imageScope(image);
    if (image.isPrimary && !primaryOf.has(scope)) primaryOf.set(scope, index);
  });
  images.forEach((image, index) => {
    const scope = imageScope(image);
    if (!primaryOf.has(scope)) primaryOf.set(scope, index);
  });
  return images.map((image, index) => ({ ...image, isPrimary: primaryOf.get(imageScope(image)) === index }));
};

/** Chọn ảnh `index` làm ảnh đại diện của nhóm nó. */
export const setPrimary = (images, index) => {
  const scope = imageScope(images[index]);
  return images.map((image, position) => (imageScope(image) === scope ? { ...image, isPrimary: position === index } : image));
};

/** Chuyển ảnh sang nhóm màu khác: đưa xuống cuối nhóm mới, bỏ cờ đại diện nếu nhóm mới đã có. */
export const changeImageColor = (images, index, color) => {
  const moved = { ...images[index], color: color || null };
  const rest = images.filter((_, position) => position !== index);
  const targetHasPrimary = rest.some((image) => image.isPrimary && imageScope(image) === imageScope(moved));
  return [...rest, { ...moved, isPrimary: moved.isPrimary && !targetHasPrimary }];
};

/**
 * Payload lưu ảnh (API cũ, không đổi): sắp theo nhóm, `displayOrder` tính lại theo vị trí,
 * đúng một ảnh đại diện mỗi nhóm; ảnh mới mặc định `GALLERY`, ảnh cũ giữ `imageType` đã lưu.
 */
export const toImagePayload = (images = [], colorOptions = []) => {
  const ordered = imageGroups(images, colorOptions).flatMap((group) => group.images);
  return ensureOnePrimary(ordered).map((image, index) => ({
    _id: image._id,
    imageUrl: image.imageUrl,
    imageType: image.imageType || 'GALLERY',
    isPrimary: Boolean(image.isPrimary),
    displayOrder: index,
    color: image.color || null,
  }));
};

/** Sắp ảnh tải về theo displayOrder để làm thứ tự ban đầu trong nhóm. */
export const sortByDisplayOrder = (images = []) => [...images]
  .map((image, index) => ({ image, index }))
  .sort((a, b) => (Number(a.image.displayOrder) || 0) - (Number(b.image.displayOrder) || 0) || a.index - b.index)
  .map(({ image }) => image);
