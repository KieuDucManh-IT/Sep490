/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-004
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-005
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-003
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-005
 *
 * 100% Native Fetch API (Zero-Axios) Service cho Danh sách Yêu thích & Bộ sưu tập cá nhân
 * Tuân thủ quy chuẩn CLAUDE.md và NFR-006.
 */

export const GUEST_WISHLIST_KEY = 'vestora_guest_wishlist';

// Helper lấy API base URL chuẩn
export const getApiBase = () => {
  const envUrl = typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL;
  const rawBase = (envUrl || 'http://localhost:5001').trim();
  return rawBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');
};

// Helper gắn Auth Header từ LocalStorage
export const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  try {
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (_) {}
  return headers;
};

// Hàm gọi API nguyên bản (Native Fetch)
export const apiFetch = async (endpoint, options = {}) => {
  const baseUrl = getApiBase();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data.message || `Lỗi yêu cầu HTTP: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

// ==========================================
// GUEST LOCALSTORAGE HELPERS
// ==========================================

export const getGuestWishlist = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const setGuestWishlist = (items) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items));
    }
  } catch (_) {}
};

export const clearGuestWishlist = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GUEST_WISHLIST_KEY);
    }
  } catch (_) {}
};

export const isGuestWishlisted = (productId) => {
  const list = getGuestWishlist();
  const idStr = String(productId);
  return list.some((item) => (typeof item === 'string' ? item === idStr : item._id === idStr || item.productId === idStr));
};

export const toggleGuestWishlistItem = (productOrId) => {
  const idStr = typeof productOrId === 'string' ? productOrId : (productOrId._id || productOrId.productId || '').toString();
  if (!idStr) return { isWishlisted: false, itemCount: 0 };

  const current = getGuestWishlist();
  const exists = current.some((it) => (typeof it === 'string' ? it === idStr : it._id === idStr || it.productId === idStr));

  let updated;
  let isWishlisted;

  if (exists) {
    updated = current.filter((it) => (typeof it === 'string' ? it !== idStr : it._id !== idStr && it.productId !== idStr));
    isWishlisted = false;
  } else {
    // Lưu thông tin item dạng object nếu có hoặc fallback string
    const itemToStore = typeof productOrId === 'object' && productOrId !== null ? productOrId : idStr;
    updated = [itemToStore, ...current];
    isWishlisted = true;
  }

  setGuestWishlist(updated);

  return {
    isWishlisted,
    productId: idStr,
    itemCount: updated.length,
    items: updated,
  };
};

// ==========================================
// WISHLIST API CALLS (Native Fetch)
// ==========================================

/**
 * Thả tim / Bỏ tim 1-click
 * POST /api/v1/wishlist/toggle
 */
export const toggleWishlistItem = async (productId) => {
  const res = await apiFetch('/api/v1/wishlist/toggle', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  });
  return res.data;
};

/**
 * Lấy danh sách yêu thích mặc định
 * GET /api/v1/wishlist
 */
export const getDefaultWishlist = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', params.limit);
  const qStr = query.toString() ? `?${query.toString()}` : '';

  const res = await apiFetch(`/api/v1/wishlist${qStr}`, {
    method: 'GET',
  });
  return res.data;
};

/**
 * Kiểm tra trạng thái yêu thích của danh sách sản phẩm
 * POST /api/v1/wishlist/check-status
 */
export const checkWishlistStatus = async (productIds = []) => {
  const res = await apiFetch('/api/v1/wishlist/check-status', {
    method: 'POST',
    body: JSON.stringify({ productIds }),
  });
  return res.data;
};

/**
 * Đồng bộ danh sách yêu thích khi đăng nhập
 * POST /api/v1/wishlist/sync
 */
export const syncWishlistOnLogin = async (productIds = []) => {
  const res = await apiFetch('/api/v1/wishlist/sync', {
    method: 'POST',
    body: JSON.stringify({ productIds }),
  });
  return res.data;
};

// ==========================================
// COLLECTIONS API CALLS (Native Fetch)
// ==========================================

/**
 * Lấy danh sách tất cả bộ sưu tập cá nhân
 * GET /api/v1/collections
 */
export const getUserCollections = async () => {
  const res = await apiFetch('/api/v1/collections', {
    method: 'GET',
  });
  return res.data;
};

/**
 * Tạo mới bộ sưu tập cá nhân
 * POST /api/v1/collections
 */
export const createCollection = async (payload) => {
  const res = await apiFetch('/api/v1/collections', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
};

/**
 * Lấy chi tiết bộ sưu tập và sản phẩm
 * GET /api/v1/collections/:id
 */
export const getCollectionDetail = async (collectionId, params = {}) => {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', params.limit);
  const qStr = query.toString() ? `?${query.toString()}` : '';

  const res = await apiFetch(`/api/v1/collections/${collectionId}${qStr}`, {
    method: 'GET',
  });
  return res.data;
};

/**
 * Cập nhật thông tin bộ sưu tập
 * PUT /api/v1/collections/:id
 */
export const updateCollection = async (collectionId, payload) => {
  const res = await apiFetch(`/api/v1/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
};

/**
 * Xóa bộ sưu tập tùy chỉnh
 * DELETE /api/v1/collections/:id
 */
export const deleteCollection = async (collectionId) => {
  const res = await apiFetch(`/api/v1/collections/${collectionId}`, {
    method: 'DELETE',
  });
  return res.data;
};

/**
 * Thêm sản phẩm vào bộ sưu tập
 * POST /api/v1/collections/:id/items
 */
export const addItemToCollection = async (collectionId, itemPayload) => {
  const res = await apiFetch(`/api/v1/collections/${collectionId}/items`, {
    method: 'POST',
    body: JSON.stringify(itemPayload),
  });
  return res.data;
};

/**
 * Xóa sản phẩm khỏi bộ sưu tập
 * DELETE /api/v1/collections/:id/items/:itemId
 */
export const removeItemFromCollection = async (collectionId, itemId) => {
  const res = await apiFetch(`/api/v1/collections/${collectionId}/items/${itemId}`, {
    method: 'DELETE',
  });
  return res.data;
};

/**
 * Cập nhật ghi chú phong cách và ngày sử dụng
 * PATCH /api/v1/collections/:id/items/:itemId
 */
export const updateItemNotes = async (collectionId, itemId, notesPayload) => {
  const res = await apiFetch(`/api/v1/collections/${collectionId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(notesPayload),
  });
  return res.data;
};

/**
 * Bật/Tắt chia sẻ công khai Lookbook
 * PATCH /api/v1/collections/:id/share
 */
export const toggleShareCollection = async (collectionId, isPrivate) => {
  const res = await apiFetch(`/api/v1/collections/${collectionId}/share`, {
    method: 'PATCH',
    body: JSON.stringify({ isPrivate }),
  });
  return res.data;
};

/**
 * Xem Lookbook công khai theo shareCode (Public)
 * GET /api/v1/collections/shared/:shareCode
 */
export const getSharedLookbook = async (shareCode) => {
  const res = await apiFetch(`/api/v1/collections/shared/${shareCode}`, {
    method: 'GET',
  });
  return res.data;
};

/**
 * Sao chép Lookbook công khai vào tủ đồ cá nhân
 * POST /api/v1/collections/shared/:shareCode/clone
 */
export const cloneSharedLookbook = async (shareCode) => {
  const res = await apiFetch(`/api/v1/collections/shared/${shareCode}/clone`, {
    method: 'POST',
  });
  return res.data;
};

const wishlistService = {
  GUEST_WISHLIST_KEY,
  getGuestWishlist,
  setGuestWishlist,
  clearGuestWishlist,
  isGuestWishlisted,
  toggleGuestWishlistItem,
  toggleWishlistItem,
  getDefaultWishlist,
  checkWishlistStatus,
  syncWishlistOnLogin,
  getUserCollections,
  createCollection,
  getCollectionDetail,
  updateCollection,
  deleteCollection,
  addItemToCollection,
  removeItemFromCollection,
  updateItemNotes,
  toggleShareCollection,
  getSharedLookbook,
  cloneSharedLookbook,
};

export default wishlistService;
