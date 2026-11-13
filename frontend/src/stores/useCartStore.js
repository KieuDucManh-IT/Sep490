/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-001
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-002
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-003
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-004
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-006
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-007
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-009
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-010
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-011
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-012
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-014
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-015
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-017
 * Zustand Shopping Cart Store for Vestora Fashion Rental & Resale
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  MAX_CART_ITEMS,
  ORDER_TYPES,
  CART_STORAGE_KEY,
  CART_ERROR_CODES,
  CART_ERROR_MESSAGES,
} from '../services/cart/cartTypes';
import {
  calculateRentalDays,
  validateRentalDates,
  calculateRentalLineTotals,
  calculateSaleLineTotals,
  calculateCartSubtotals,
} from '../services/cart/cartCalculations';

/**
 * Check whether a string is a valid 24-character hexadecimal MongoDB ObjectId
 */
export function isValidObjectId(id) {
  if (!id) return false;
  return /^[0-9a-fA-F]{24}$/.test(String(id).trim());
}

/**
 * Recalculate line totals for a single cart item
 */
function refreshItemTotals(item) {
  const qty = Math.max(1, Number(item.quantity) || 1);
  if (item.orderType === ORDER_TYPES.RENTAL) {
    const days = item.rentalDays || calculateRentalDays(item.startDate, item.dueDate) || 1;
    const totals = calculateRentalLineTotals(
      item.rentalPricePerDay,
      item.depositAmount,
      days,
      qty
    );
    return {
      ...item,
      quantity: qty,
      rentalDays: days,
      lineRentalFee: totals.lineRentalFee,
      lineDeposit: totals.lineDeposit,
      lineTotal: totals.lineTotal,
    };
  }

  const totals = calculateSaleLineTotals(item.salePrice, qty);
  return {
    ...item,
    quantity: qty,
    lineRentalFee: 0,
    lineDeposit: 0,
    lineTotal: totals.lineTotal,
  };
}

/**
 * Generate a deterministic or random client unique ID for cart line items
 */
function generateCartItemId(item) {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const prefix = item.orderType === ORDER_TYPES.RENTAL ? 'rent' : 'sale';
  return `cart-${prefix}-${item.variantId}-${Date.now()}-${randomSuffix}`;
}

const initialSubtotals = calculateCartSubtotals([]);

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      // Computed financial metrics & item count
      totalItemCount: initialSubtotals.totalItemCount,
      rentalFeeSubtotal: initialSubtotals.rentalFeeSubtotal,
      depositSubtotal: initialSubtotals.depositSubtotal,
      saleSubtotal: initialSubtotals.saleSubtotal,
      grandTotal: initialSubtotals.grandTotal,

      /**
       * Mở Cart Drawer
       */
      openCart: () => set({ isOpen: true }),

      /**
       * Đóng Cart Drawer
       */
      closeCart: () => set({ isOpen: false }),

      /**
       * Chuyển đổi trạng thái đóng/mở Cart Drawer
       */
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      /**
       * Thêm món đồ vào giỏ (Thuê hoặc Mua)
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-002
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-003
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-004
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-006
       */
      addItem: (inputItem) => {
        if (!inputItem || !inputItem.variantId || !isValidObjectId(inputItem.variantId)) {
          return {
            success: false,
            errorCode: 'ERR_INVALID_VARIANT',
            errorMessage: 'Thông tin biến thể sản phẩm không hợp lệ.',
          };
        }

        if (
          inputItem.selectedBranch?.locationId &&
          !isValidObjectId(inputItem.selectedBranch.locationId)
        ) {
          return {
            success: false,
            errorCode: 'ERR_INVALID_LOCATION',
            errorMessage: 'Thông tin chi nhánh không hợp lệ.',
          };
        }

        const rawQuantity = Number(inputItem.quantity !== undefined ? inputItem.quantity : 1);
        if (Number.isNaN(rawQuantity) || rawQuantity <= 0) {
          return {
            success: false,
            errorCode: CART_ERROR_CODES.ERR_INVALID_QUANTITY,
            errorMessage: CART_ERROR_MESSAGES[CART_ERROR_CODES.ERR_INVALID_QUANTITY],
          };
        }
        const quantityToAdd = Math.min(99, Math.floor(rawQuantity));

        const state = get();
        const currentItems = [...state.items];
        const isRental = inputItem.orderType === ORDER_TYPES.RENTAL;

        // Nếu là đồ thuê: Validate ngày thuê trước
        let rentalDays = 1;
        if (isRental) {
          const dateValidation = validateRentalDates(inputItem.startDate, inputItem.dueDate);
          if (!dateValidation.isValid) {
            return {
              success: false,
              errorCode: dateValidation.errorCode,
              errorMessage: dateValidation.errorMessage,
            };
          }
          rentalDays = dateValidation.rentalDays;
        }

        // Tìm kiếm sản phẩm tương tự đã có trong giỏ
        let existingIndex = -1;
        if (isRental) {
          // Trùng variantId VÀ trùng ngày nhận VÀ trùng ngày trả -> gộp số lượng
          existingIndex = currentItems.findIndex(
            (it) =>
              it.orderType === ORDER_TYPES.RENTAL &&
              it.variantId === inputItem.variantId &&
              it.startDate === inputItem.startDate &&
              it.dueDate === inputItem.dueDate
          );
        } else {
          // Đồ mua: Trùng variantId -> gộp số lượng
          existingIndex = currentItems.findIndex(
            (it) => it.orderType === ORDER_TYPES.SALE && it.variantId === inputItem.variantId
          );
        }

        let updatedItems;

        if (existingIndex > -1) {
          // Cập nhật số lượng món đã tồn tại
          const existingItem = currentItems[existingIndex];
          const newQty = Math.min(99, existingItem.quantity + quantityToAdd);
          const updatedItem = refreshItemTotals({
            ...existingItem,
            quantity: newQty,
            selectedBranch: inputItem.selectedBranch || existingItem.selectedBranch || null,
          });
          updatedItems = [...currentItems];
          updatedItems[existingIndex] = updatedItem;
        } else {
          // Kiểm tra giới hạn 50 món độc lập trong giỏ
          if (currentItems.length >= MAX_CART_ITEMS) {
            return {
              success: false,
              errorCode: CART_ERROR_CODES.ERR_CART_CAPACITY,
              errorMessage: CART_ERROR_MESSAGES[CART_ERROR_CODES.ERR_CART_CAPACITY],
            };
          }

          // Tạo item mới
          const newItem = refreshItemTotals({
            cartItemId: generateCartItemId(inputItem),
            productId: inputItem.productId,
            variantId: inputItem.variantId,
            productCode: inputItem.productCode || '',
            sku: inputItem.sku || '',
            name: inputItem.name || 'Trang phục Vestora',
            size: inputItem.size || '',
            color: inputItem.color || '',
            thumbnailImage: inputItem.thumbnailImage || '',
            orderType: inputItem.orderType || ORDER_TYPES.SALE,
            quantity: quantityToAdd,
            salePrice: Number(inputItem.salePrice) || 0,
            rentalPricePerDay: Number(inputItem.rentalPricePerDay) || 0,
            depositAmount: Number(inputItem.depositAmount) || 0,
            startDate: inputItem.startDate || null,
            dueDate: inputItem.dueDate || null,
            rentalDays,
            selectedBranch: inputItem.selectedBranch || null,
          });

          updatedItems = [...currentItems, newItem];
        }

        const subtotals = calculateCartSubtotals(updatedItems);
        set({
          items: updatedItems,
          ...subtotals,
        });

        return {
          success: true,
          itemCount: subtotals.totalItemCount,
        };
      },

      /**
       * Cập nhật số lượng của một dòng sản phẩm
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-007
       */
      updateQuantity: (cartItemId, quantity) => {
        const qty = Number(quantity);
        if (Number.isNaN(qty) || qty < 1) {
          return {
            success: false,
            errorCode: CART_ERROR_CODES.ERR_INVALID_QUANTITY,
            errorMessage: CART_ERROR_MESSAGES[CART_ERROR_CODES.ERR_INVALID_QUANTITY],
          };
        }

        const safeQty = Math.min(99, Math.floor(qty));
        const state = get();
        const itemIndex = state.items.findIndex((it) => it.cartItemId === cartItemId);

        if (itemIndex === -1) {
          return {
            success: false,
            errorMessage: 'Không tìm thấy sản phẩm trong giỏ hàng.',
          };
        }

        const updatedItem = refreshItemTotals({
          ...state.items[itemIndex],
          quantity: safeQty,
        });

        const updatedItems = [...state.items];
        updatedItems[itemIndex] = updatedItem;
        const subtotals = calculateCartSubtotals(updatedItems);

        set({
          items: updatedItems,
          ...subtotals,
        });

        return { success: true };
      },

      /**
       * Cập nhật ngày thuê của một món đồ trong giỏ
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-009
       */
      updateRentalDates: (cartItemId, startDate, dueDate) => {
        const state = get();
        const itemIndex = state.items.findIndex((it) => it.cartItemId === cartItemId);

        if (itemIndex === -1) {
          return {
            success: false,
            errorMessage: 'Không tìm thấy sản phẩm trong giỏ hàng.',
          };
        }

        const targetItem = state.items[itemIndex];
        if (targetItem.orderType !== ORDER_TYPES.RENTAL) {
          return {
            success: false,
            errorMessage: 'Chỉ có thể cập nhật ngày thuê cho trang phục thuê.',
          };
        }

        const validation = validateRentalDates(startDate, dueDate);
        if (!validation.isValid) {
          return {
            success: false,
            errorCode: validation.errorCode,
            errorMessage: validation.errorMessage,
          };
        }

        const updatedItem = refreshItemTotals({
          ...targetItem,
          startDate,
          dueDate,
          rentalDays: validation.rentalDays,
        });

        const updatedItems = [...state.items];
        updatedItems[itemIndex] = updatedItem;
        const subtotals = calculateCartSubtotals(updatedItems);

        set({
          items: updatedItems,
          ...subtotals,
        });

        return { success: true };
      },

      /**
       * Cập nhật chi nhánh (và biến thể nếu cần sửa) cho một món đồ trong giỏ
       */
      updateItemBranch: (cartItemId, branchData) => {
        const state = get();
        const itemIndex = state.items.findIndex((it) => it.cartItemId === cartItemId);
        if (itemIndex === -1) {
          return { success: false, errorMessage: 'Không tìm thấy sản phẩm trong giỏ hàng.' };
        }

        const { variantId, ...branchInfo } = branchData || {};
        const target = state.items[itemIndex];
        const updatedItems = [...state.items];
        updatedItems[itemIndex] = {
          ...target,
          selectedBranch: branchInfo.locationId ? branchInfo : target.selectedBranch,
          ...(variantId ? { variantId } : {}),
        };

        set({ items: updatedItems });
        return { success: true };
      },

      /**
       * Xóa nhiều món đồ khỏi giỏ hàng
       */
      removeItems: (cartItemIds = []) => {
        const state = get();
        const idSet = new Set(cartItemIds);
        const updatedItems = state.items.filter((it) => !idSet.has(it.cartItemId));
        const subtotals = calculateCartSubtotals(updatedItems);

        set({
          items: updatedItems,
          ...subtotals,
        });

        return { success: true };
      },

      /**
       * Xóa một món đồ khỏi giỏ hàng
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-010
       */
      removeItem: (cartItemId) => {
        const state = get();
        const updatedItems = state.items.filter((it) => it.cartItemId !== cartItemId);
        const subtotals = calculateCartSubtotals(updatedItems);

        set({
          items: updatedItems,
          ...subtotals,
        });

        return { success: true };
      },

      /**
       * Xóa toàn bộ giỏ hàng
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-011
       */
      clearCart: () => {
        const subtotals = calculateCartSubtotals([]);
        set({
          items: [],
          ...subtotals,
        });
        return { success: true };
      },

      /**
       * Đóng gói payload gửi sang trang Checkout
       * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-017
       */
      getCheckoutPayload: () => {
        const state = get();
        const rentalItems = state.items
          .filter((it) => it.orderType === ORDER_TYPES.RENTAL)
          .map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            sku: it.sku,
            name: it.name,
            size: it.size,
            color: it.color,
            quantity: it.quantity,
            startDate: it.startDate,
            dueDate: it.dueDate,
            rentalDays: it.rentalDays,
            rentalPricePerDay: it.rentalPricePerDay,
            depositPerUnit: it.depositAmount,
            lineRentalFee: it.lineRentalFee,
            lineDeposit: it.lineDeposit,
          }));

        const saleItems = state.items
          .filter((it) => it.orderType === ORDER_TYPES.SALE)
          .map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            sku: it.sku,
            name: it.name,
            size: it.size,
            color: it.color,
            quantity: it.quantity,
            salePrice: it.salePrice,
            lineTotal: it.lineTotal,
          }));

        return {
          rentalItems,
          saleItems,
          summary: {
            rentalFeeSubtotal: state.rentalFeeSubtotal,
            depositSubtotal: state.depositSubtotal,
            saleSubtotal: state.saleSubtotal,
            grandTotal: state.grandTotal,
            totalItemCount: state.totalItemCount,
          },
        };
      },
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Chỉ lưu trữ items vào LocalStorage; isOpen là UI state tạm thời
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          console.warn('[useCartStore] Error during rehydration, resetting state:', error);
          if (state && typeof state.clearCart === 'function') {
            state.clearCart();
          }
          return;
        }

        try {
          if (!Array.isArray(state.items)) {
            state.items = [];
          }
          // Lọc bỏ các sản phẩm rác hoặc có variantId không hợp lệ
          const validItems = state.items.filter(
            (it) => it && it.variantId && isValidObjectId(it.variantId)
          );
          const refreshed = validItems.map(refreshItemTotals);
          const subtotals = calculateCartSubtotals(refreshed);
          state.items = refreshed;
          Object.assign(state, subtotals);
        } catch (e) {
          console.warn('[useCartStore] Corrupted storage payload, resetting cart:', e);
          state.items = [];
          Object.assign(state, calculateCartSubtotals([]));
        }
      },
    }
  )
);
