export const RENTAL_STATUS_MAP = {
  draft: { text: 'Đơn mới', chipClass: 'draft' },
  confirmed: { text: 'Chờ giao trang phục', chipClass: 'confirmed' },
  renting: { text: 'Đang cho thuê', chipClass: 'renting' },
  partially_returned: { text: 'Đã trả một phần', chipClass: 'partially_returned' },
  returned: { text: 'Đã trả đủ trang phục', chipClass: 'returned' },
  overdue: { text: 'Quá hạn hoàn trả', chipClass: 'overdue' },
  cancelled: { text: 'Đã hủy đơn', chipClass: 'cancelled' },
};

export const SALES_STATUS_MAP = {
  draft: { text: 'Đơn mới', chipClass: 'draft' },
  confirmed: { text: 'Chờ đóng gói', chipClass: 'confirmed' },
  processing: { text: 'Đang chuẩn bị hàng', chipClass: 'processing' },
  completed: { text: 'Giao hàng thành công', chipClass: 'completed' },
  cancelled: { text: 'Đã hủy đơn', chipClass: 'cancelled' },
};

export const DEPOSIT_STATUS_MAP = {
  pending: { text: 'Chưa đặt cọc', chipClass: 'pending' },
  held: { text: 'Đang giữ tiền cọc', chipClass: 'completed' },
  refunded: { text: 'Đã hoàn trả tiền cọc', chipClass: 'processing' },
  partially_refunded: { text: 'Đã hoàn cọc một phần', chipClass: 'partially_returned' },
  partially_deducted: { text: 'Trừ cọc do lỗi/hỏng', chipClass: 'pending' },
  forfeited: { text: 'Khấu trừ toàn bộ cọc', chipClass: 'cancelled' },
};

export const PAYMENT_STATUS_MAP = {
  unpaid: { text: 'Chưa thanh toán', chipClass: 'cancelled' },
  partial: { text: 'Thanh toán một phần', chipClass: 'pending' },
  paid: { text: 'Đã thanh toán đủ', chipClass: 'completed' },
  refunded: { text: 'Đã hoàn lại tiền', chipClass: 'processing' },
  partially_refunded: { text: 'Đã hoàn tiền một phần', chipClass: 'partially_returned' },
};

/**
 * Format currency strictly in VND (e.g. "1.500.000 VND")
 */
export const formatCurrency = (val) => {
  const num = Number(val || 0);
  const formatted = new Intl.NumberFormat('vi-VN').format(isNaN(num) ? 0 : num);
  return `${formatted} VND`;
};

/**
 * Format date in standard friendly Vietnamese format
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format rental period in friendly Vietnamese date range
 */
export const formatPeriod = (start, due) => {
  if (!start && !due) return 'Chưa ấn định';
  const formatSingle = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };
  const formatEnd = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  return `${formatSingle(start)} → ${formatEnd(due)}`;
};
