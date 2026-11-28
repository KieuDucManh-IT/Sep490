// Phân trang phía server cho danh sách phiếu kho. Hàm thuần, không import DB.
// Quy ước tương thích ngược: request có `page` hoặc `limit` → trả { items, total, page, limit };
// không có → service trả mảng như cũ (frontend cũ chưa gửi page).

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

const hasValue = (value) => value !== undefined && value !== null;

const toPositiveInteger = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return number;
};

/**
 * Đọc page/limit từ query. Số sai hoặc < 1 dùng mặc định; limit tối đa 100.
 * `enabled` = người gọi có gửi page hoặc limit (bật chế độ phân trang).
 */
export const parsePaging = (query = {}) => {
  const enabled = hasValue(query?.page) || hasValue(query?.limit);
  const page = toPositiveInteger(query?.page, 1);
  const limit = Math.min(toPositiveInteger(query?.limit, DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT);
  return { enabled, page, limit, skip: (page - 1) * limit };
};

/** Shape trả về thống nhất cho mọi danh sách có phân trang. */
export const pagedResult = (items, total, paging) => ({
  items,
  total,
  page: paging.page,
  limit: paging.limit,
});

/** Thoát ký tự đặc biệt để chuỗi người dùng gõ được dùng an toàn trong RegExp. */
export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex tìm kiếm không phân biệt hoa thường; chuỗi rỗng → null (không lọc). Cắt tối đa 100 ký tự. */
export const searchRegex = (search) => {
  const text = String(search ?? '').trim().slice(0, 100);
  if (!text) return null;
  return new RegExp(escapeRegex(text), 'i');
};

/** Gom danh sách bản ghi theo một field id → Map(id → mảng bản ghi), giữ nguyên thứ tự đầu vào. */
export const groupByField = (rows, field) => {
  const groups = new Map();
  for (const row of rows) {
    const key = String(row?.[field]?._id || row?.[field] || '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
};
