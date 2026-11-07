export const SHIPMENT_STATUS_MAP = {
  preparing: { text: 'Chờ lấy hàng', chipClass: 'pending', color: 'warning' },
  shipped: { text: 'Đang vận chuyển', chipClass: 'processing', color: 'primary' },
  delivered: { text: 'Giao thành công', chipClass: 'completed', color: 'success' },
  failed: { text: 'Giao thất bại', chipClass: 'cancelled', color: 'danger' },
  cancelled: { text: 'Đã hủy', chipClass: 'cancelled', color: 'secondary' },
};

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

