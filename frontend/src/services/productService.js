// productService.js – Quản lý mọi lời gọi API liên quan đến Product.

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Lấy danh sách sản phẩm có tìm kiếm, lọc và phân trang.
 * @param {{ search?: string, tag?: string, status?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ data: Array, pagination: Object }>}
 */
export async function fetchProducts({ search = '', tag = '', status = '', page = 1, limit = 10 } = {}) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) qs.set('search', search);
  if (tag) qs.set('tag', tag);
  if (status) qs.set('status', status);
  const res = await fetch(`${API_URL}/products?${qs}`);
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không tải được danh sách sản phẩm');
  return { data: result.data || [], pagination: result.pagination || { page: 1, pages: 1, total: 0 } };
}

export async function fetchAllProducts(params = {}) {
  // The backend validates list limits to a maximum of 100.
  const first = await fetchProducts({ ...params, page: 1, limit: 100 });
  const data = [...first.data];
  for (let page = 2; page <= (first.pagination.pages || 1); page += 1) {
    const result = await fetchProducts({ ...params, page, limit: 100 });
    data.push(...result.data);
  }
  return data;
}

/**
 * Tạo sản phẩm mới.
 * @param {Object} payload
 * @returns {Promise<Object>} product vừa tạo
 */
export async function createProduct(payload) {
  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không tạo được sản phẩm');
  return result.data;
}

/**
 * Cập nhật sản phẩm.
 * @param {string} id
 * @param {Object} payload
 * @returns {Promise<Object>} product sau cập nhật
 */
export async function updateProduct(id, payload) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không cập nhật được sản phẩm');
  return result.data;
}

/**
 * Xóa mềm sản phẩm.
 * @param {string} id
 */
export async function deleteProduct(id) {
  const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không xóa được sản phẩm');
}
