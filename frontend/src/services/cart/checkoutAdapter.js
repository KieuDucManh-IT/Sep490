/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-016
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-017
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-018
 * @ears .sdd/features/shopping-cart/SPEC.md#NFR-SEC-01
 * Frozen Contract: checkoutPayloadAdapter v1.0.0
 * Adapter to package client cart state into standardized CheckoutPayload contract
 */

import { ORDER_TYPES } from './cartTypes';
import { calculateCartSubtotals } from './cartCalculations';

/**
 * Tạo CheckoutPayload chuẩn hóa từ trạng thái giỏ hàng
 * @param {Object} cartState - Trạng thái từ useCartStore hoặc { items, ... }
 * @returns {Object} CheckoutPayload
 */
export function createCheckoutPayload(cartState = {}) {
  const items = Array.isArray(cartState.items) ? cartState.items : [];

  const rentalItems = items
    .filter((item) => item.orderType === ORDER_TYPES.RENTAL)
    .map((item) => ({
      productId: String(item.productId || ''),
      variantId: String(item.variantId || ''),
      sku: String(item.sku || ''),
      name: String(item.name || ''),
      size: String(item.size || ''),
      color: String(item.color || ''),
      thumbnailImage: String(item.thumbnailImage || ''),
      quantity: Math.max(1, Number(item.quantity) || 1),
      startDate: String(item.startDate || ''),
      dueDate: String(item.dueDate || ''),
      rentalDays: Math.max(1, Number(item.rentalDays) || 1),
      rentalPricePerDay: Math.max(0, Number(item.rentalPricePerDay) || 0),
      depositPerUnit: Math.max(0, Number(item.depositAmount) || 0),
    }));

  const saleItems = items
    .filter((item) => item.orderType === ORDER_TYPES.SALE)
    .map((item) => ({
      productId: String(item.productId || ''),
      variantId: String(item.variantId || ''),
      sku: String(item.sku || ''),
      name: String(item.name || ''),
      size: String(item.size || ''),
      color: String(item.color || ''),
      thumbnailImage: String(item.thumbnailImage || ''),
      quantity: Math.max(1, Number(item.quantity) || 1),
      salePrice: Math.max(0, Number(item.salePrice) || 0),
    }));

  const calculatedSubtotals = calculateCartSubtotals(items);

  return {
    contractVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    rentalItems,
    saleItems,
    summary: {
      rentalFeeSubtotal: calculatedSubtotals.rentalFeeSubtotal,
      depositSubtotal: calculatedSubtotals.depositSubtotal,
      saleSubtotal: calculatedSubtotals.saleSubtotal,
      grandTotal: calculatedSubtotals.grandTotal,
      totalItemCount: calculatedSubtotals.totalItemCount,
    },
  };
}

/**
 * Kiểm tra tính hợp lệ của CheckoutPayload trước khi gửi hoặc chuyển tiếp
 * @param {Object} payload - Đối tượng CheckoutPayload
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateCheckoutPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Payload rỗng hoặc không đúng định dạng.'] };
  }

  const rentalItems = Array.isArray(payload.rentalItems) ? payload.rentalItems : [];
  const saleItems = Array.isArray(payload.saleItems) ? payload.saleItems : [];

  if (rentalItems.length === 0 && saleItems.length === 0) {
    errors.push('Giỏ hàng trống. Vui lòng chọn ít nhất một sản phẩm để thanh toán.');
  }

  // Validate rental items
  for (let i = 0; i < rentalItems.length; i++) {
    const it = rentalItems[i];
    if (!it.variantId) {
      errors.push(`Mục thuê thứ ${i + 1} thiếu thông tin biến thể sản phẩm (variantId).`);
    }
    if (!it.startDate || !it.dueDate) {
      errors.push(`Mục thuê thứ ${i + 1} chưa chọn đủ ngày nhận hoặc ngày trả.`);
    }
    if (it.rentalDays < 1) {
      errors.push(`Mục thuê thứ ${i + 1} có số ngày thuê không hợp lệ.`);
    }
    if (it.quantity < 1) {
      errors.push(`Mục thuê thứ ${i + 1} có số lượng nhỏ hơn 1.`);
    }
  }

  // Validate sale items
  for (let i = 0; i < saleItems.length; i++) {
    const it = saleItems[i];
    if (!it.variantId) {
      errors.push(`Mục mua thứ ${i + 1} thiếu thông tin biến thể sản phẩm (variantId).`);
    }
    if (it.quantity < 1) {
      errors.push(`Mục mua thứ ${i + 1} có số lượng nhỏ hơn 1.`);
    }
    if (it.salePrice < 0) {
      errors.push(`Mục mua thứ ${i + 1} có đơn giá không hợp lệ.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Tạo Payload chuẩn hóa cho đơn mua hàng (SalesOrder)
 * @param {Object} cartState - Trạng thái từ useCartStore hoặc { items, ... }
 * @returns {Object} SaleCheckoutPayload
 */
export function createSaleCheckoutPayload(cartState = {}) {
  const items = Array.isArray(cartState.items) ? cartState.items : [];
  const saleItems = items
    .filter((item) => item.orderType === ORDER_TYPES.SALE)
    .map((item) => ({
      cartItemId: item.cartItemId,
      productId: String(item.productId || ''),
      variantId: String(item.variantId || ''),
      sku: String(item.sku || ''),
      name: String(item.name || ''),
      size: String(item.size || ''),
      color: String(item.color || ''),
      thumbnailImage: String(item.thumbnailImage || ''),
      quantity: Math.max(1, Number(item.quantity) || 1),
      salePrice: Math.max(0, Number(item.salePrice) || 0),
      selectedBranch: item.selectedBranch || null,
      locationId: item.selectedBranch?.locationId ? String(item.selectedBranch.locationId) : null,
      note: item.note || '',
    }));

  const calculatedSubtotals = calculateCartSubtotals(items);

  return {
    contractVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    saleItems,
    summary: {
      subtotal: calculatedSubtotals.saleSubtotal,
      shippingFee: 0,
      totalAmount: calculatedSubtotals.saleSubtotal,
      totalItemCount: saleItems.reduce((acc, it) => acc + it.quantity, 0),
    },
  };
}

