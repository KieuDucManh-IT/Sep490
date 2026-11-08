/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-004
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-005
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-012
 * Pure Calculation Functions for Vestora Shopping Cart
 */

import {
  MAX_RENTAL_DAYS,
  MIN_RENTAL_DAYS,
  ORDER_TYPES,
  CART_ERROR_CODES,
  CART_ERROR_MESSAGES,
} from './cartTypes.js';

/**
 * Truncate date to YYYY-MM-DD string or parse to timestamp at 00:00:00
 */
export function parseDateOnly(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('T')[0].split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
    }
  }
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Tính số ngày thuê giữa ngày nhận và ngày trả
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-004
 * @param {string|Date} startDate - Ngày nhận trang phục
 * @param {string|Date} dueDate - Ngày trả trang phục
 * @returns {number} Số ngày thuê (tối thiểu 1 ngày nếu cùng ngày)
 */
export function calculateRentalDays(startDate, dueDate) {
  const start = parseDateOnly(startDate);
  const due = parseDateOnly(dueDate);

  if (!start || !due) return 0;
  if (due < start) return 0;

  const diffMs = due.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Nhận và trả trong cùng ngày tính là 1 ngày thuê
  return Math.max(MIN_RENTAL_DAYS, diffDays);
}

/**
 * Xác thực khoảng ngày thuê hợp lệ
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-005
 */
export function validateRentalDates(startDate, dueDate) {
  const start = parseDateOnly(startDate);
  const due = parseDateOnly(dueDate);
  const today = parseDateOnly(new Date());

  if (!start || !due) {
    return {
      isValid: false,
      errorCode: CART_ERROR_CODES.ERR_INVALID_DATES,
      errorMessage: 'Vui lòng chọn ngày nhận và ngày trả trang phục.',
      rentalDays: 0,
    };
  }

  // Ngày nhận không được trong quá khứ
  if (start < today) {
    return {
      isValid: false,
      errorCode: CART_ERROR_CODES.ERR_INVALID_DATES,
      errorMessage: CART_ERROR_MESSAGES[CART_ERROR_CODES.ERR_INVALID_DATES],
      rentalDays: 0,
    };
  }

  // Ngày trả phải lớn hơn hoặc bằng ngày nhận
  if (due < start) {
    return {
      isValid: false,
      errorCode: CART_ERROR_CODES.ERR_INVALID_DATES,
      errorMessage: CART_ERROR_MESSAGES[CART_ERROR_CODES.ERR_INVALID_DATES],
      rentalDays: 0,
    };
  }

  const rentalDays = calculateRentalDays(start, due);

  // Không vượt quá 30 ngày
  if (rentalDays > MAX_RENTAL_DAYS) {
    return {
      isValid: false,
      errorCode: CART_ERROR_CODES.ERR_RENTAL_TOO_LONG,
      errorMessage: CART_ERROR_MESSAGES[CART_ERROR_CODES.ERR_RENTAL_TOO_LONG],
      rentalDays,
    };
  }

  return {
    isValid: true,
    rentalDays,
  };
}

/**
 * Tính toán thành tiền và tiền cọc của một mục thuê
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-004
 */
export function calculateRentalLineTotals(rentalPricePerDay = 0, depositAmount = 0, rentalDays = 1, quantity = 1) {
  const safeDays = Math.max(MIN_RENTAL_DAYS, Number(rentalDays) || 1);
  const safeQty = Math.max(1, Number(quantity) || 1);
  const safePrice = Math.max(0, Number(rentalPricePerDay) || 0);
  const safeDeposit = Math.max(0, Number(depositAmount) || 0);

  const lineRentalFee = safePrice * safeDays * safeQty;
  const lineDeposit = safeDeposit * safeQty;

  return {
    lineRentalFee,
    lineDeposit,
    lineTotal: lineRentalFee,
  };
}

/**
 * Tính toán thành tiền của một mục mua
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-002
 */
export function calculateSaleLineTotals(salePrice = 0, quantity = 1) {
  const safeQty = Math.max(1, Number(quantity) || 1);
  const safePrice = Math.max(0, Number(salePrice) || 0);

  const lineTotal = safePrice * safeQty;

  return {
    lineTotal,
    lineRentalFee: 0,
    lineDeposit: 0,
  };
}

/**
 * Tính toán bảng tổng kết chi phí giỏ hàng
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-012
 */
export function calculateCartSubtotals(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      rentalFeeSubtotal: 0,
      depositSubtotal: 0,
      saleSubtotal: 0,
      grandTotal: 0,
      totalItemCount: 0,
    };
  }

  let rentalFeeSubtotal = 0;
  let depositSubtotal = 0;
  let saleSubtotal = 0;
  let totalItemCount = 0;

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    totalItemCount += qty;

    if (item.orderType === ORDER_TYPES.RENTAL) {
      const days = item.rentalDays || calculateRentalDays(item.startDate, item.dueDate) || 1;
      const lineTotals = calculateRentalLineTotals(
        item.rentalPricePerDay,
        item.depositAmount,
        days,
        qty
      );
      rentalFeeSubtotal += lineTotals.lineRentalFee;
      depositSubtotal += lineTotals.lineDeposit;
    } else {
      const lineTotals = calculateSaleLineTotals(item.salePrice, qty);
      saleSubtotal += lineTotals.lineTotal;
    }
  }

  const grandTotal = rentalFeeSubtotal + depositSubtotal + saleSubtotal;

  return {
    rentalFeeSubtotal,
    depositSubtotal,
    saleSubtotal,
    grandTotal,
    totalItemCount,
  };
}

/**
 * Định dạng tiền tệ VND chuẩn Haute Couture
 */
export function formatCurrencyVND(amount = 0) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
}
