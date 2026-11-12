import apiClient from './api';

function getOrCreateGuestId() {
  let guestId = localStorage.getItem('vestora_guest_id');
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem('vestora_guest_id', guestId);
  }
  return guestId;
}

export const wardrobeApi = {
  /**
   * Lấy danh sách tủ đồ cá nhân từ backend
   */
  getWardrobe: async () => {
    const guestId = getOrCreateGuestId();
    const res = await apiClient.get('/wardrobe', {
      params: { guestId },
    });
    return res?.data || [];
  },

  /**
   * Thêm trang phục vào tủ đồ (lưu ảnh vừa thử + link sản phẩm)
   * @param {Object} itemData
   */
  addToWardrobe: async (itemData) => {
    const guestId = getOrCreateGuestId();
    const payload = {
      ...itemData,
      guestId,
    };
    const res = await apiClient.post('/wardrobe', payload);
    return res;
  },

  /**
   * Xoá trang phục khỏi tủ đồ
   * @param {string} id
   */
  removeFromWardrobe: async (id) => {
    const res = await apiClient.delete(`/wardrobe/${id}`);
    return res;
  },
};

export default wardrobeApi;

