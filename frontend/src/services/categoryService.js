// categoryService.js – Quản lý mọi lời gọi API liên quan đến Category.

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Lấy toàn bộ danh mục đang active.
 * @returns {Promise<Array>} mảng category objects
 */
export async function fetchCategories() {
  const res = await fetch(`${API_URL}/categories`);
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không tải được danh mục');
  return result.data || [];
}

/**
 * Tạo danh mục mới.
 * @param {{ name: string, description?: string }} data
 * @returns {Promise<Object>} category vừa tạo
 */
export async function createCategory(data) {
  const res = await fetch(`${API_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không tạo được danh mục');
  return result.data;
}

/**
 * Cập nhật danh mục.
 * @param {string} id
 * @param {{ name?: string, description?: string, status?: string }} data
 * @returns {Promise<Object>} category sau cập nhật
 */
export async function updateCategory(id, data) {
  const res = await fetch(`${API_URL}/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không cập nhật được danh mục');
  return result.data;
}

/**
 * Xóa mềm danh mục.
 * @param {string} id
 */
export async function deleteCategory(id) {
  const res = await fetch(`${API_URL}/categories/${id}`, { method: 'DELETE' });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không xóa được danh mục');
}
