export const RENTAL_STATUS_MAP = {
  draft: { text: 'Đơn mới', chipClass: 'draft' },
  confirmed: { text: 'Chờ giao trang phục', chipClass: 'confirmed' },
  renting: { text: 'Đang cho thuê', chipClass: 'renting' },
  partially_returned: { text: 'Đã trả một phần', chipClass: 'partially_returned' },
  returned: { text: 'Đã trả đủ trang phục', chipClass: 'returned' },
  overdue: { text: 'Quá hạn hoàn trả', chipClass: 'overdue' },
  cancelled: { text: 'Đã hủy', chipClass: 'cancelled' },
};

export const SALES_STATUS_MAP = {
  draft: { text: 'Đơn mới', chipClass: 'draft' },
  confirmed: { text: 'Chờ đóng gói', chipClass: 'confirmed' },
  processing: { text: 'Đang chuẩn bị hàng', chipClass: 'processing' },
  completed: { text: 'Giao hàng thành công', chipClass: 'completed' },
  cancelled: { text: 'Đã hủy', chipClass: 'cancelled' },
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

/**
 * Xác định nhãn và màu sắc trạng thái hiển thị thông minh đồng bộ giữa Khách hàng và Branch Manager
 * Tự động cập nhật theo trạng thái vận đơn GHN (Chờ lấy hàng, Đang giao hàng, Đang thuê, Đã hoàn tất, Đã hủy)
 */
export const resolveOrderDisplayStatus = (order, type = 'rental', isBranch = false) => {
  if (!order) return { text: 'Chưa rõ', chipClass: 'draft' };

  const isSale = type === 'sale' || Boolean(order.orderStatus && !order.rentalStatus);
  const currentStatus = isSale ? (order.orderStatus || order.status) : (order.rentalStatus || order.status);

  // 1. Đơn bị hủy ở cấp đơn hàng (Order Level) -> Hiển thị "Đã hủy"
  if (currentStatus === 'cancelled') {
    return {
      text: 'Đã hủy',
      chipClass: 'cancelled',
    };
  }

  // 2. Vận đơn đang trong hành trình giao nhận thực tế (chỉ xét: preparing, shipped, delivered)
  // Các vận đơn đã hủy (cancelled) là vé hủy, KHÔNG làm đơn hàng bị hủy
  const allShipments = Array.isArray(order.shipments)
    ? order.shipments
    : (order.shipment ? [order.shipment] : []);

  const activeShipment = allShipments.find(
    (s) => s && ['preparing', 'shipped', 'delivered'].includes(s.shipmentStatus)
  );

  if (activeShipment) {
    const isReturn = activeShipment.shipmentType === 'return';

    if (activeShipment.shipmentStatus === 'shipped') {
      return {
        text: isReturn
          ? (isBranch ? 'Đang thu hồi về shop' : 'Đang Thu Hồi')
          : (isBranch ? 'Đang giao hàng' : 'Đang Giao Hàng'),
        chipClass: 'processing',
      };
    }

    if (activeShipment.shipmentStatus === 'delivered') {
      if (isReturn) {
        return {
          text: isBranch ? 'Đã nhận hàng thu hồi' : 'Đã Hoàn Tất',
          chipClass: 'returned',
        };
      }
      if (isSale) {
        return {
          text: isBranch ? 'Giao hàng thành công' : 'Đã Hoàn Tất',
          chipClass: 'completed',
        };
      }
      return {
        text: isBranch ? 'Đang cho thuê' : 'Đang Thuê',
        chipClass: 'renting',
      };
    }

    if (activeShipment.shipmentStatus === 'preparing') {
      return {
        text: isReturn
          ? (isBranch ? 'Chờ lấy hàng thu hồi' : 'Chờ Shipper Thu Hồi')
          : (isBranch ? 'Chờ lấy hàng' : 'Chờ Lấy Hàng'),
        chipClass: 'confirmed',
      };
    }
  }

  // 3. Nếu toàn bộ vận đơn xuất hàng (outbound) đã bị hủy và không có vận đơn active -> Hiển thị "Đã hủy"
  const outboundShipments = allShipments.filter((s) => s && s.shipmentType !== 'return');
  if (outboundShipments.length > 0 && outboundShipments.every((s) => s.shipmentStatus === 'cancelled')) {
    return {
      text: 'Đã hủy',
      chipClass: 'cancelled',
    };
  }

  // 4. Trạng thái vòng đời của đơn thuê / đơn mua khi không có vận đơn đang active
  if (!isSale) {
    if (currentStatus === 'renting') {
      return {
        text: isBranch ? 'Đang cho thuê' : 'Đang Thuê',
        chipClass: 'renting',
      };
    }
    if (currentStatus === 'partially_returned') {
      return {
        text: isBranch ? 'Đã trả một phần' : 'Đã Trả Một Phần',
        chipClass: 'partially_returned',
      };
    }
    if (currentStatus === 'returned') {
      return {
        text: isBranch ? 'Đã trả đủ trang phục' : 'Đã Hoàn Tất',
        chipClass: 'returned',
      };
    }
    if (currentStatus === 'overdue') {
      return {
        text: isBranch ? 'Quá hạn hoàn trả' : 'Quá Hạn Trả',
        chipClass: 'overdue',
      };
    }
    // Mặc định cho confirmed hoặc draft
    return {
      text: isBranch ? 'Chờ giao trang phục' : 'Chờ Giao Đồ',
      chipClass: 'confirmed',
    };
  }

  // Đối với đơn bán (Sale)
  if (currentStatus === 'completed') {
    return {
      text: isBranch ? 'Giao hàng thành công' : 'Đã Hoàn Tất',
      chipClass: 'completed',
    };
  }
  if (currentStatus === 'processing') {
    return {
      text: isBranch ? 'Đang chuẩn bị hàng' : 'Đang Chuẩn Bị',
      chipClass: 'processing',
    };
  }
  return {
    text: isBranch ? 'Chờ đóng gói' : 'Đã Xác Nhận',
    chipClass: 'confirmed',
  };
};
