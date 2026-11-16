// Quy tắc ảnh sản phẩm theo màu (TASK-007):
// - color: null  → ảnh chung của sản phẩm
// - color: "Cam" → ảnh của màu đó, dùng cho mọi size
// Ảnh đại diện: ảnh chính chung → ảnh chính của màu đầu tiên → ảnh đầu tiên theo displayOrder.

export const normalizeColorKey = (value) => String(value ?? '').trim().toLowerCase();

const byDisplayOrder = (a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0)
  || new Date(a.createdAt || 0) - new Date(b.createdAt || 0);

/** Ẩn ảnh của màu không còn biến thể đang bán (chỉ dùng khi hiển thị cho khách). */
export const visibleImageRecords = (records = [], activeColors = null) => {
  if (!activeColors) return records;
  const keys = new Set([...activeColors].map(normalizeColorKey));
  return records.filter((record) => !record.color || keys.has(normalizeColorKey(record.color)));
};

export const pickRepresentativeImage = (records = []) => {
  if (!records.length) return null;
  const sorted = [...records].sort(byDisplayOrder);
  return sorted.find((r) => !r.color && r.isPrimary)
    || sorted.find((r) => r.color && r.isPrimary)
    || sorted[0];
};

/** Danh sách URL với ảnh đại diện đứng đầu, phần còn lại theo displayOrder. */
export const orderedImageUrls = (records = []) => {
  const sorted = [...records].sort(byDisplayOrder);
  const representative = pickRepresentativeImage(sorted);
  const rest = sorted.filter((r) => r !== representative);
  return [...new Set([representative, ...rest].filter(Boolean).map((r) => r.imageUrl).filter(Boolean))];
};

/** { [màu]: url ảnh chính (hoặc ảnh đầu) của màu đó } */
export const colorImageMap = (records = []) => {
  const map = {};
  for (const record of [...records].sort(byDisplayOrder)) {
    if (!record.color) continue;
    const current = map[record.color];
    if (!current || (record.isPrimary && !current.isPrimary)) map[record.color] = record;
  }
  return Object.fromEntries(Object.entries(map).map(([color, record]) => [color, record.imageUrl]));
};

/** Ảnh đại diện cho nhiều sản phẩm: Map<productId, url>. */
export const representativeUrlByProduct = (records = []) => {
  const grouped = new Map();
  for (const record of records) {
    const key = String(record.productId);
    grouped.set(key, [...(grouped.get(key) || []), record]);
  }
  return new Map([...grouped].map(([key, rows]) => [key, pickRepresentativeImage(rows)?.imageUrl || '']));
};
