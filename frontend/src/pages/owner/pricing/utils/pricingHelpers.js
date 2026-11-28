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

/**
 * TASK-008: giá bắt buộc theo hình thức sản phẩm (khớp backend productPricing.missingRequiredPrices).
 * @param {string} tag - 'rental' | 'sale' | 'both'
 * @returns {string}
 */
export const requiredPriceText = (tag) => {
  const value = String(tag || '').toLowerCase();
  if (value === 'rental') return 'Sản phẩm cho thuê: bắt buộc giá thuê mỗi ngày > 0, tiền cọc ≥ 0.';
  if (value === 'sale') return 'Sản phẩm bán: bắt buộc giá bán > 0.';
  if (value === 'both') return 'Sản phẩm vừa thuê vừa bán: bắt buộc giá thuê mỗi ngày > 0 và giá bán > 0.';
  return 'Sản phẩm chưa có hình thức: cần ít nhất giá thuê mỗi ngày hoặc giá bán > 0.';
};

/**
 * Kiểm tra xem sản phẩm đã được cấu hình giá thuê và tiền cọc hay chưa
 * @param {Object} item
 * @returns {boolean}
 */
export const isRentalConfigured = (item) => {
  if (!item) return false;
  const rent = Number(item.rentalPricePerDay || 0);
  const deposit = Number(item.deposit || 0);
  return rent > 0 && deposit > 0;
};

export const PRODUCT_NAME_MAX_LENGTH = 40;
export const PRODUCT_CODE_MAX_LENGTH = 22;

/**
 * Giới hạn số ký tự hiển thị cho chuỗi dài (kèm dấu ...)
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export const truncateText = (text, maxLength = PRODUCT_NAME_MAX_LENGTH) => {
  if (!text) return '';
  const str = String(text).trim();
  if (str.length <= maxLength) return str;
  return `${str.slice(0, Math.max(1, maxLength)).trimEnd()}...`;
};

/**
 * Chuẩn hóa thông tin hiển thị loại hình kinh doanh của sản phẩm (đồ thuê / đồ mua)
 * @param {string} tag - 'rental' | 'sale' | 'both'
 * @returns {{ key: string, label: string, toneClass: string }}
 */
export const getProductTagMeta = (tag) => {
  const normalized = String(tag || '').trim().toLowerCase();
  if (normalized === 'rental') {
    return { key: 'rental', label: 'Đồ thuê', toneClass: 'type-rental' };
  }
  if (normalized === 'sale') {
    return { key: 'sale', label: 'Đồ mua', toneClass: 'type-sale' };
  }
  if (normalized === 'both') {
    return { key: 'both', label: 'Thuê & Mua', toneClass: 'type-both' };
  }
  return { key: 'unknown', label: 'Chưa phân loại', toneClass: 'type-unknown' };
};

/**
 * Kiểm tra sản phẩm có khớp bộ lọc loại hình (phân tách rạch ròi để số đếm cộng đúng bằng tổng)
 * @param {string} itemTag
 * @param {string} filterValue - 'ALL' | 'rental' | 'sale' | 'both' | 'unknown'
 * @returns {boolean}
 */
export const matchesProductTagFilter = (itemTag, filterValue = 'ALL') => {
  const filter = String(filterValue || 'ALL').trim().toLowerCase();
  if (!filter || filter === 'all') return true;
  const normalized = String(itemTag || '').trim().toLowerCase();
  if (filter === 'unknown') return !['rental', 'sale', 'both'].includes(normalized);
  return normalized === filter;
};

/**
 * Tính KPI bảng giá: chỉ chia trung bình trên các sản phẩm thực tế có giá thuê / tiền cọc (> 0)
 * @param {Array<Object>} items
 * @returns {{ total: number, rentalCount: number, depositCount: number, avgRental: number, avgDeposit: number }}
 */
export const computePricingKpis = (items = []) => {
  const total = items.length;
  const rentalItems = items.filter((i) => Number(i.rentalPricePerDay || 0) > 0);
  const depositItems = items.filter((i) => Number(i.deposit || 0) > 0);
  const avgRental = rentalItems.length
    ? Math.round(rentalItems.reduce((s, i) => s + Number(i.rentalPricePerDay || 0), 0) / rentalItems.length)
    : 0;
  const avgDeposit = depositItems.length
    ? Math.round(depositItems.reduce((s, i) => s + Number(i.deposit || 0), 0) / depositItems.length)
    : 0;
  return {
    total,
    rentalCount: rentalItems.length,
    depositCount: depositItems.length,
    avgRental,
    avgDeposit,
  };
};

