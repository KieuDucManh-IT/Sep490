/**
 * Tiện ích hỗ trợ tính toán và định dạng dữ liệu cho module Bảng Giá & Tiền Cọc
 */

/**
 * Hàm tính số tiền tự động dựa trên tỷ lệ % nhân với Giá mặt hàng (Giá bán / Định giá trang phục).
 * Số tiền = Math.round((Giá mặt hàng * %) / 100)
 *
 * @param {number|string} itemPrice - Giá mặt hàng (Giá bán / Định giá trang phục)
 * @param {number|string} percent - Tỷ lệ % (ví dụ: 5, 10, 50, 70...)
 * @returns {number} Số tiền tương ứng
 */
export const calculateAmountByPercent = (itemPrice, percent) => {
  const price = Number(itemPrice) || 0;
  const pct = Number(percent) || 0;
  if (price <= 0 || pct <= 0) return 0;
  return Math.round((price * pct) / 100);
};

// Aliases cho tính tiền cọc và tiền thuê để duy trì ngữ nghĩa nghiệp vụ
export const calculateDeposit = calculateAmountByPercent;
export const calculateRentalPrice = calculateAmountByPercent;

/**
 * Định dạng số tiền sang chuẩn tiền tệ VND
 *
 * @param {number|string} num - Giá trị số
 * @returns {string} Chuỗi hiển thị (vd: "1.500.000 VND")
 */
export const fmtCurrency = (num) => {
  if (num === null || num === undefined || isNaN(Number(num))) return '0 VND';
  const val = Number(num);
  return val ? `${val.toLocaleString('vi-VN')} VND` : '0 VND';
};

/**
 * Định dạng ngày tháng theo chuẩn Việt Nam (DD/MM/YYYY)
 *
 * @param {string|Date} dateStr - Chuỗi ISO hoặc đối tượng Date
 * @returns {string} Chuỗi ngày định dạng hoặc "Mặc định"
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return 'Mặc định';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Mặc định';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'Mặc định';
  }
};
