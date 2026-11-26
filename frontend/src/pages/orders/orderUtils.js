export const RENTAL_STATUS_MAP = {
  draft: { text: 'Đơn mới', chipClass: 'draft' },
  confirmed: { text: 'Chờ giao hàng', chipClass: 'confirmed' },
  renting: { text: 'Đang cho thuê', chipClass: 'renting' },
  partially_returned: { text: 'Đã trả một phần', chipClass: 'partially_returned' },
  returned: { text: 'Đã trả đồ hoàn tất', chipClass: 'returned' },
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
 * Format date only (DD/MM/YYYY) for rental start/due dates without misleading UTC hours
 */
export const formatDateOnly = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

export const truncateText = (val, maxLength = 24) => {
  const text = String(val ?? '');
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

/**
 * Xác định nhãn và màu sắc trạng thái hiển thị thông minh đồng bộ giữa Khách hàng và Branch Manager
 * Tự động cập nhật theo trạng thái vận đơn GHN (Chờ lấy hàng, Đang giao hàng, Đang thuê, Đã hoàn tất, Đã hủy)
 */
export const resolveOrderDisplayStatus = (order, type = 'rental', isBranch = false) => {
  if (!order) return { text: 'Chưa rõ', chipClass: 'draft' };

  const isSale = type === 'sale' || Boolean(order.orderStatus && !order.rentalStatus);
  const currentStatus = isSale ? (order.orderStatus || order.status) : (order.rentalStatus || order.status);
  if (isSale) {
    const returnStates = {
      requested: {
        text: 'Chờ lấy hàng trả',
        chipClass: 'confirmed',
      },
      returning: {
        text: 'Đang chuyển hàng trả về shop',
        chipClass: 'processing',
      },
      received: {
        text: 'Đã về shop, chờ nghiệm thu',
        chipClass: 'processing',
      },
      completed: {
        text: 'Đã trả hàng hoàn tất',
        chipClass: 'returned',
      },
    };

    if (returnStates[order.returnStatus]) {
      return returnStates[order.returnStatus];
    }
  }
  // Ưu tiên kết quả nghiệm thu của đơn thuê.
  if (!isSale && currentStatus === 'returned') {
    return RENTAL_STATUS_MAP.returned;
  }

  // 1. Vận đơn đang trong hành trình giao nhận thực tế (chỉ xét: preparing, shipped, delivered)
  // Ưu tiên hiển thị theo vận đơn return đang active, hoặc vận đơn active mới nhất
  const allShipments = Array.isArray(order.shipments)
    ? order.shipments
    : (order.shipment ? [order.shipment] : []);

  const activeShipments = allShipments
    .filter((s) => {
      if (!s || !['preparing', 'shipped', 'delivered'].includes(s.shipmentStatus)) return false;
      if (s.shipmentType === 'return' && s.settled) return false;
      if (!isSale && currentStatus === 'partially_returned' && s.shipmentType !== 'return' && s.shipmentStatus === 'delivered') {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Ưu tiên vận đơn return đang active trong quá trình thu hồi đồ
      const aIsReturn = a.shipmentType === 'return';
      const bIsReturn = b.shipmentType === 'return';
      if (aIsReturn && !bIsReturn) return -1;
      if (!aIsReturn && bIsReturn) return 1;
      return (new Date(b.createdAt || b.updatedAt || 0).getTime() || 0) -
        (new Date(a.createdAt || a.updatedAt || 0).getTime() || 0);
    });

  const activeShipment = activeShipments[0];

  if (activeShipment) {
    const isReturn = activeShipment.shipmentType === 'return';

    if (activeShipment.shipmentStatus === 'shipped') {
      return {
        text: isReturn
          ? (isBranch ? 'Đang thu hồi về shop' : 'Đang chuyển về cửa hàng')
          : (isBranch ? 'Đang giao hàng' : 'Đang Giao Hàng'),
        chipClass: 'processing',
      };
    }

    if (activeShipment.shipmentStatus === 'delivered') {
      if (isReturn) {
        return {
          text: 'Đã về shop, chờ nghiệm thu',
          chipClass: 'warning',
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
          ? (isBranch ? 'Chờ lấy hàng thu hồi' : 'Chờ shipper lấy đồ trả')
          : (isBranch ? 'Chờ lấy hàng' : 'Chờ Lấy Hàng'),
        chipClass: 'confirmed',
      };
    }
  }

  // 2. Nếu đơn bị hủy ở cấp đơn hàng HOẶC toàn bộ vận đơn xuất hàng đã bị hủy và không có vận đơn active -> Hiển thị "Đã hủy"
  const outboundShipments = allShipments.filter((s) => s && s.shipmentType !== 'return');
  const allOutboundCancelled = outboundShipments.length > 0 && outboundShipments.every((s) => s.shipmentStatus === 'cancelled');

  if (currentStatus === 'cancelled' || allOutboundCancelled) {
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

    if (currentStatus === 'overdue') {
      return {
        text: isBranch ? 'Quá hạn hoàn trả' : 'Quá Hạn Trả',
        chipClass: 'overdue',
      };
    }
    // Mặc định cho confirmed hoặc draft
    return {
      text: isBranch ? 'Chờ giao hàng' : 'Chờ Giao Hàng',
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

/** Trích xuất lý do hủy đơn từ field riêng, ghi chú đơn hoặc vận đơn đã hủy. */
export const extractOrderCancelReason = (order, shipments = []) => {
  if (order?.cancelReason && String(order.cancelReason).trim()) {
    return String(order.cancelReason).trim();
  }
  const note = String(order?.note || '');
  const rentalMatch = note.match(/Hủy đơn:\s*([^;]+)/);
  if (rentalMatch?.[1]?.trim()) {
    return rentalMatch[1].trim();
  }
  const ghnMatch = note.match(/\[Hủy vận đơn GHN:\s*([^\]]+)\]/);
  if (ghnMatch?.[1]?.trim()) {
    return ghnMatch[1].trim();
  }
  const cancelledShip = (Array.isArray(shipments) ? shipments : []).find(
    (s) => s?.shipmentStatus === 'cancelled' && s?.cancellationReason
  );
  return cancelledShip?.cancellationReason ? String(cancelledShip.cancellationReason).trim() : '';
};
