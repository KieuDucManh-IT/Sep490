// productVariantService.js – Quản lý mọi lời gọi API liên quan đến ProductVariant.

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Lấy tất cả variants của một product.
 * @param {string} productId
 * @returns {Promise<Array>} mảng variant objects
 */
export async function fetchVariantsByProduct(productId) {
  const res = await fetch(`${API_URL}/products/${productId}/variants`);
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không tải được variant');
  return result.data || [];
}

/**
 * Lấy tất cả variants từ nhiều sản phẩm, ghép tên sản phẩm vào từng variant.
 * @param {Array<{ _id: string, name: string }>} products
 * @returns {Promise<Array>} mảng variant objects với productName & productId đã gắn
 */
export async function fetchAllVariantsWithProductNames(products) {
  const grouped = await Promise.allSettled(
    products.map(async (prod) => {
      const variants = await fetchVariantsByProduct(prod._id);
      return variants.map((v) => ({
        ...v,
        productId: prod._id,
        productName: prod.name,
      }));
    })
  );
  return grouped
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}

/**
 * Tạo variant mới cho sản phẩm.
 * @param {string} productId
 * @param {{ size: number, color: string, condition: string, quantity: number, status: string }} payload
 * @returns {Promise<Object>} variant vừa tạo
 */
export async function createVariant(productId, payload) {
  const res = await fetch(`${API_URL}/products/${productId}/variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không tạo được variant');
  return result.data;
}

/**
 * Cập nhật variant.
 * @param {string} productId
 * @param {string} variantId
 * @param {Object} payload
 * @returns {Promise<Object>} variant sau cập nhật
 */
export async function updateVariant(productId, variantId, payload) {
  const res = await fetch(`${API_URL}/products/${productId}/variants/${variantId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không cập nhật được variant');
  return result.data;
}

/**
 * Xóa mềm variant.
 * @param {string} productId
 * @param {string} variantId
 */
export async function deleteVariant(productId, variantId) {
  const res = await fetch(`${API_URL}/products/${productId}/variants/${variantId}`, {
    method: 'DELETE',
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || 'Không xóa được variant');
}
