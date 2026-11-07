/**
 * GHN Status Mapper & Descriptions
 */

export const GHN_STATUS_MAP = {
  // Chuẩn bị & lấy hàng
  ready_to_pick: {
    internalStatus: 'preparing',
    description: 'Đơn hàng đã tiếp nhận, đang chờ bưu tá GHN đến lấy hàng',
  },
  picking: {
    internalStatus: 'preparing',
    description: 'Bưu tá GHN đang trên đường tới điểm lấy hàng',
  },
  money_collect_picking: {
    internalStatus: 'preparing',
    description: 'Đang tương tác thu tiền người gửi',
  },

  // Đang vận chuyển
  picked: {
    internalStatus: 'shipped',
    description: 'Bưu tá GHN đã lấy hàng thành công và nhập kho',
  },
  storing: {
    internalStatus: 'shipped',
    description: 'Hàng hóa đang được lưu tại kho trung chuyển GHN',
  },
  transporting: {
    internalStatus: 'shipped',
    description: 'Hàng hóa đang được luân chuyển giữa các bưu cục',
  },
  sorting: {
    internalStatus: 'shipped',
    description: 'Đang phân loại bưu kiện tại trung tâm khai thác',
  },
  delivering: {
    internalStatus: 'shipped',
    description: 'Shipper GHN đang trên đường đi giao hàng tới người nhận',
  },
  money_collect_delivering: {
    internalStatus: 'shipped',
    description: 'Đang giao hàng và thu hộ tiền COD',
  },

  // Giao thành công
  delivered: {
    internalStatus: 'delivered',
    description: 'Đơn hàng đã được giao thành công cho người nhận',
  },

  // Thất bại & sự cố
  delivery_fail: {
    internalStatus: 'failed',
    description: 'Giao hàng không thành công (người nhận hẹn lại hoặc không liên lạc được)',
  },
  lost: {
    internalStatus: 'failed',
    description: 'Sự cố thất lạc bưu phẩm trong quá trình vận chuyển',
  },
  damage: {
    internalStatus: 'failed',
    description: 'Hàng hóa bị hư hỏng trong quá trình vận chuyển',
  },

  // Hoàn hàng & Hủy
  waiting_to_return: {
    internalStatus: 'cancelled',
    description: 'Đang chờ xác nhận chuyển hoàn về người gửi',
  },
  return: {
    internalStatus: 'cancelled',
    description: 'Hàng đang được chuyển hoàn về lại kho gửi',
  },
  returned: {
    internalStatus: 'cancelled',
    description: 'Đã hoàn trả hàng về cho người gửi',
  },
  cancel: {
    internalStatus: 'cancelled',
    description: 'Đơn vận chuyển đã được hủy',
  },
};

/**
 * Map a raw GHN status code to internal status and friendly text
 * @param {string} ghnStatus - e.g. "ready_to_pick", "delivering", "delivered"
 * @returns {{ internalStatus: string, description: string }}
 */
export const mapGhnStatus = (ghnStatus) => {
  const normalized = String(ghnStatus || '').toLowerCase().trim();
  if (GHN_STATUS_MAP[normalized]) {
    return GHN_STATUS_MAP[normalized];
  }

  // Fallback defaults
  if (normalized.includes('deliver') && !normalized.includes('fail')) {
    return { internalStatus: 'delivered', description: 'Giao hàng thành công' };
  }
  if (normalized.includes('cancel') || normalized.includes('return')) {
    return { internalStatus: 'cancelled', description: 'Đơn vận chuyển đã hủy/hoàn' };
  }
  if (normalized.includes('fail')) {
    return { internalStatus: 'failed', description: 'Giao hàng thất bại' };
  }
  if (normalized.includes('pick')) {
    return { internalStatus: 'preparing', description: 'Đang chuẩn bị lấy hàng' };
  }

  return {
    internalStatus: 'shipped',
    description: `Trạng thái GHN: ${ghnStatus}`,
  };
};

