/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-001
 * Cart Types, Constants & Enums for Vestora Shopping Cart
 */

export const MAX_CART_ITEMS = 50;
export const MAX_RENTAL_DAYS = 30;
export const MIN_RENTAL_DAYS = 1;
export const CART_STORAGE_KEY = 'vestora_cart_state';

export const ORDER_TYPES = {
  RENTAL: 'rental',
  SALE: 'sale',
};

export const CART_ERROR_CODES = {
  ERR_CART_CAPACITY: 'ERR_CART_CAPACITY',
  ERR_INVALID_DATES: 'ERR_INVALID_DATES',
  ERR_RENTAL_TOO_LONG: 'ERR_RENTAL_TOO_LONG',
  ERR_INVALID_QUANTITY: 'ERR_INVALID_QUANTITY',
  ERR_STORAGE_CORRUPT: 'ERR_STORAGE_CORRUPT',
};

export const CART_ERROR_MESSAGES = {
  [CART_ERROR_CODES.ERR_CART_CAPACITY]: 'Giỏ hàng của quý khách đã đạt giới hạn tối đa 50 món đồ.',
  [CART_ERROR_CODES.ERR_INVALID_DATES]: 'Khoảng thời gian thuê không hợp lệ. Vui lòng chọn ngày nhận từ hôm nay và ngày trả sau ngày nhận.',
  [CART_ERROR_CODES.ERR_RENTAL_TOO_LONG]: 'Vestora hiện hỗ trợ thuê trực tuyến tối đa 30 ngày. Quý khách vui lòng liên hệ tư vấn viên cho nhu cầu thuê dài hạn.',
  [CART_ERROR_CODES.ERR_INVALID_QUANTITY]: 'Số lượng sản phẩm không hợp lệ (tối thiểu là 1).',
  [CART_ERROR_CODES.ERR_STORAGE_CORRUPT]: 'Dữ liệu giỏ hàng bị lỗi, hệ thống đã tự động làm mới.',
};
