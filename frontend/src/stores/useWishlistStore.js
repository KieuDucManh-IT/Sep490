/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-004
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-005
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-004
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-005
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-007
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-010
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-011
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-003
 *
 * Zustand Store quản lý Danh sách Yêu thích & Bộ sưu tập Tủ đồ cá nhân (Vestora)
 */

import { create } from 'zustand';
import * as wishlistService from '../services/customer/wishlistService';

// Helper kiểm tra trạng thái đăng nhập
const isUserLoggedIn = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      return Boolean(localStorage.getItem('token'));
    }
  } catch (_) {}
  return false;
};

export const useWishlistStore = create((set, get) => ({
  // State
  wishlistedIds: [],
  itemCount: 0,
  defaultWishlist: {
    collection: null,
    items: [],
    hasMore: false,
    nextCursor: null,
  },
  collections: [],
  activeCollection: null,
  isLoading: false,
  error: null,

  // Helper kiểm tra một sản phẩm có đang được thả tim không
  isWishlisted: (productId) => {
    if (!productId) return false;
    const idStr = String(productId);
    return get().wishlistedIds.includes(idStr);
  },

  /**
   * Tải danh sách yêu thích mặc định
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-001
   */
  fetchWishlist: async () => {
    set({ isLoading: true, error: null });
    try {
      if (isUserLoggedIn()) {
        const data = await wishlistService.getDefaultWishlist();
        const ids = (data.items || [])
          .map((item) => (item.productId?._id ? item.productId._id.toString() : item.productId?.toString()))
          .filter(Boolean);

        set({
          defaultWishlist: data,
          itemCount: data.totalCount ?? ids.length,
          wishlistedIds: ids,
          isLoading: false,
        });
      } else {
        // Khách chưa đăng nhập: Nạp từ LocalStorage
        const guestItems = wishlistService.getGuestWishlist();
        const ids = guestItems.map((it) => (typeof it === 'string' ? it : (it._id || it.productId || '').toString())).filter(Boolean);
        const mappedItems = guestItems.map((it, idx) => ({
          _id: `guest_${idx}`,
          productId: typeof it === 'object' ? it : { _id: it, name: 'Sản phẩm yêu thích' },
        }));

        set({
          defaultWishlist: {
            collection: { name: 'Tất cả yêu thích', isDefault: true, itemCount: ids.length },
            items: mappedItems,
            hasMore: false,
            nextCursor: null,
          },
          itemCount: ids.length,
          wishlistedIds: ids,
          isLoading: false,
        });
      }
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  /**
   * Thả tim hoặc Bỏ tim sản phẩm với Optimistic Update tức thì
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-002
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-003
   */
  toggleWishlist: async (productOrId) => {
    const rawId = typeof productOrId === 'object' && productOrId !== null
      ? (productOrId._id || productOrId.productId || '')
      : productOrId;
    const productId = String(rawId);
    if (!productId) return false;

    const prevState = get();
    const currentlyWishlisted = prevState.wishlistedIds.includes(productId);
    const nextWishlisted = !currentlyWishlisted;

    // 1. Optimistic Update trạng thái ngay lập tức trên UI
    const updatedIds = nextWishlisted
      ? [...prevState.wishlistedIds, productId]
      : prevState.wishlistedIds.filter((id) => id !== productId);

    const updatedCount = Math.max(0, prevState.itemCount + (nextWishlisted ? 1 : -1));

    // Cập nhật optimistic cho defaultWishlist items
    let updatedItems = [...prevState.defaultWishlist.items];
    if (nextWishlisted) {
      const newEntry = {
        _id: `temp_${Date.now()}`,
        productId: typeof productOrId === 'object' ? productOrId : { _id: productId },
        createdAt: new Date(),
      };
      updatedItems = [newEntry, ...updatedItems];
    } else {
      updatedItems = updatedItems.filter((item) => {
        const itemPid = item.productId?._id ? item.productId._id.toString() : item.productId?.toString();
        return itemPid !== productId;
      });
    }

    set({
      wishlistedIds: updatedIds,
      itemCount: updatedCount,
      defaultWishlist: {
        ...prevState.defaultWishlist,
        items: updatedItems,
        totalCount: updatedCount,
      },
    });

    // 2. Gọi API hoặc lưu LocalStorage
    try {
      if (isUserLoggedIn()) {
        const apiRes = await wishlistService.toggleWishlistItem(productId);
        if (typeof apiRes.itemCount === 'number') {
          set({ itemCount: apiRes.itemCount });
        }
      } else {
        wishlistService.toggleGuestWishlistItem(productOrId);
      }
      return nextWishlisted;
    } catch (err) {
      // 3. Rollback nếu có lỗi từ server (ví dụ: quá 100 món)
      set({
        wishlistedIds: prevState.wishlistedIds,
        itemCount: prevState.itemCount,
        defaultWishlist: prevState.defaultWishlist,
        error: err.message,
      });
      throw err;
    }
  },

  /**
   * Đồng bộ danh sách yêu thích khi đăng nhập
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-005
   */
  syncOnLogin: async () => {
    try {
      const guestItems = wishlistService.getGuestWishlist();
      const productIds = guestItems
        .map((it) => (typeof it === 'string' ? it : (it._id || it.productId || '').toString()))
        .filter(Boolean);

      if (productIds.length > 0) {
        await wishlistService.syncWishlistOnLogin(productIds);
        wishlistService.clearGuestWishlist();
      }

      await get().fetchWishlist();
      await get().fetchCollections();
    } catch (err) {
      console.error('Lỗi đồng bộ yêu thích sau khi đăng nhập:', err);
    }
  },

  /**
   * Lấy danh sách tất cả bộ sưu tập của người dùng
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
   */
  fetchCollections: async () => {
    if (!isUserLoggedIn()) {
      set({ collections: [] });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const collections = await wishlistService.getUserCollections();
      set({ collections, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  /**
   * Chọn một bộ sưu tập để xem chi tiết
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
   */
  selectCollection: async (collectionId) => {
    if (!collectionId) {
      set({ activeCollection: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const detail = await wishlistService.getCollectionDetail(collectionId);
      set({ activeCollection: detail, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  /**
   * Tạo mới một bộ sưu tập
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-002
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-003
   */
  createCollection: async (data) => {
    const newCol = await wishlistService.createCollection(data);
    set((state) => ({
      collections: [newCol, ...state.collections],
    }));
    return newCol;
  },

  /**
   * Cập nhật thông tin bộ sưu tập
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-004
   */
  updateCollection: async (collectionId, data) => {
    const updated = await wishlistService.updateCollection(collectionId, data);
    set((state) => ({
      collections: state.collections.map((c) => (c._id === collectionId ? updated : c)),
      activeCollection:
        state.activeCollection?.collection?._id === collectionId
          ? { ...state.activeCollection, collection: updated }
          : state.activeCollection,
    }));
    return updated;
  },

  /**
   * Xóa bộ sưu tập tùy chỉnh
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-005
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-006
   */
  deleteCollection: async (collectionId) => {
    await wishlistService.deleteCollection(collectionId);
    set((state) => ({
      collections: state.collections.filter((c) => c._id !== collectionId),
      activeCollection:
        state.activeCollection?.collection?._id === collectionId ? null : state.activeCollection,
    }));
  },

  /**
   * Thêm món vào bộ sưu tập kèm ghi chú phong cách
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-007
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-008
   */
  addItemToCollection: async (collectionId, itemPayload) => {
    const newItem = await wishlistService.addItemToCollection(collectionId, itemPayload);

    set((state) => {
      const updatedCols = state.collections.map((col) => {
        if (col._id === collectionId) {
          return { ...col, itemCount: (col.itemCount || 0) + 1 };
        }
        return col;
      });

      let updatedActive = state.activeCollection;
      if (state.activeCollection?.collection?._id === collectionId) {
        updatedActive = {
          ...state.activeCollection,
          items: [newItem, ...state.activeCollection.items],
          collection: {
            ...state.activeCollection.collection,
            itemCount: (state.activeCollection.collection.itemCount || 0) + 1,
          },
        };
      }

      return {
        collections: updatedCols,
        activeCollection: updatedActive,
      };
    });

    return newItem;
  },

  /**
   * Xóa món khỏi bộ sưu tập
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-011
   */
  removeItemFromCollection: async (collectionId, itemId) => {
    await wishlistService.removeItemFromCollection(collectionId, itemId);

    set((state) => {
      const updatedCols = state.collections.map((col) => {
        if (col._id === collectionId) {
          return { ...col, itemCount: Math.max(0, (col.itemCount || 1) - 1) };
        }
        return col;
      });

      let updatedActive = state.activeCollection;
      if (state.activeCollection?.collection?._id === collectionId) {
        updatedActive = {
          ...state.activeCollection,
          items: state.activeCollection.items.filter((it) => it._id !== itemId),
          collection: {
            ...state.activeCollection.collection,
            itemCount: Math.max(0, (state.activeCollection.collection.itemCount || 1) - 1),
          },
        };
      }

      return {
        collections: updatedCols,
        activeCollection: updatedActive,
      };
    });
  },

  /**
   * Cập nhật ghi chú phong cách hoặc ngày dự kiến sử dụng
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-010
   */
  updateItemNotes: async (collectionId, itemId, notesPayload) => {
    const updatedItem = await wishlistService.updateItemNotes(collectionId, itemId, notesPayload);

    set((state) => {
      if (state.activeCollection?.collection?._id === collectionId) {
        return {
          activeCollection: {
            ...state.activeCollection,
            items: state.activeCollection.items.map((it) => (it._id === itemId ? { ...it, ...updatedItem } : it)),
          },
        };
      }
      return {};
    });

    return updatedItem;
  },

  /**
   * Bật/Tắt chia sẻ công khai Lookbook
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-001
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-002
   */
  toggleShare: async (collectionId, isPrivate) => {
    const res = await wishlistService.toggleShareCollection(collectionId, isPrivate);

    set((state) => {
      const updatedCols = state.collections.map((col) => {
        if (col._id === collectionId) {
          return { ...col, isPrivate: res.isPrivate, shareCode: res.shareCode };
        }
        return col;
      });

      let updatedActive = state.activeCollection;
      if (state.activeCollection?.collection?._id === collectionId) {
        updatedActive = {
          ...state.activeCollection,
          collection: {
            ...state.activeCollection.collection,
            isPrivate: res.isPrivate,
            shareCode: res.shareCode,
          },
        };
      }

      return {
        collections: updatedCols,
        activeCollection: updatedActive,
      };
    });

    return res;
  },

  /**
   * Chuyển một hoặc toàn bộ món trong bộ sưu tập vào giỏ hàng
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-001
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-002
   * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-003
   */
  addCollectionToCart: (items, cartStore) => {
    if (!items || !items.length || !cartStore?.addItem) {
      return { addedCount: 0, skippedCount: 0 };
    }

    let addedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const prod = item.productId || item;
      if (!prod) {
        skippedCount += 1;
        continue;
      }

      // Kiểm tra sản phẩm có khả dụng không
      const isAvailable = !prod.isDeleted && prod.status !== 'inactive' && prod.status !== 'discontinued';
      if (!isAvailable) {
        skippedCount += 1;
        continue;
      }

      const isRental = prod.tag === 'rental' || (prod.rentalPricePerDay > 0 && prod.tag !== 'sale');
      const today = new Date();
      const defaultStart = item.targetUsageDate
        ? new Date(item.targetUsageDate).toISOString().split('T')[0]
        : today.toISOString().split('T')[0];

      const returnDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const defaultDue = returnDate.toISOString().split('T')[0];

      const cartItemPayload = {
        productId: prod._id || prod.id,
        variantId: item.variantId?._id || item.variantId || null,
        productCode: prod.productCode || '',
        name: prod.name || 'Trang phục Vestora',
        thumbnailImage: prod.primaryImageUrl || '',
        orderType: isRental ? 'RENTAL' : 'SALE',
        quantity: 1,
        salePrice: prod.salePrice || 0,
        rentalPricePerDay: prod.rentalPricePerDay || 0,
        depositAmount: prod.deposit || 0,
        startDate: isRental ? defaultStart : null,
        dueDate: isRental ? defaultDue : null,
        rentalDays: isRental ? 3 : null,
      };

      const result = cartStore.addItem(cartItemPayload);
      if (result && result.success !== false) {
        addedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    return { addedCount, skippedCount };
  },
}));

export default useWishlistStore;
