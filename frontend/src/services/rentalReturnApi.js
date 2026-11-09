/**
 * Rental Return & Dispute API Service (100% Native Fetch - Zero Axios)
 * Quản lý nghiệm thu trả đồ KCS, quyết toán hoàn cọc và khiếu nại lỗi sản xuất 24h
 * @ears .sdd/features/rental-orders/SPEC.md#NFR-CLI-001
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009..REQ-RENT-017
 */

const getApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  return envUrl.replace(/\/+$/, '');
};

const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {}
  return headers;
};

/**
 * Universal Native Fetch for Rental Returns & Disputes
 */
export async function returnDisputeRequest(endpoint = '', options = {}) {
  const { method = 'GET', body, headers: customHeaders = {} } = options;
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...getAuthHeaders(),
        ...customHeaders,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        data?.message || data?.error || `Yêu cầu thất bại với mã lỗi ${response.status}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    if (controller.signal.aborted) {
      const timeoutErr = new Error('Thời gian chờ phản hồi quá 30 giây, vui lòng thử lại.');
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    const networkErr = new Error(
      error.message || 'Không thể kết nối đến máy chủ Vestora. Vui lòng kiểm tra đường truyền.'
    );
    networkErr.status = 503;
    throw networkErr;
  } finally {
    clearTimeout(timer);
  }
}

// -------------------------------------------------------------
// RENTAL RETURNS & DEPOSIT SETTLEMENT
// -------------------------------------------------------------

/**
 * Lập biên bản nghiệm thu trả đồ & quyết toán cọc
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-013..REQ-RENT-017
 */
export async function createRentalReturn(rentalOrderId, returnPayload) {
  return returnDisputeRequest(`/rental-returns/orders/${rentalOrderId}/return`, {
    method: 'POST',
    body: returnPayload,
  });
}

/**
 * Lấy chi tiết biên bản trả đồ theo ID
 */
export async function getRentalReturnById(returnId) {
  return returnDisputeRequest(`/rental-returns/${returnId}`, { method: 'GET' });
}

// -------------------------------------------------------------
// RENTAL DISPUTES & 24H DEFECT CLAIMS (MIN.DE POLICY)
// -------------------------------------------------------------

/**
 * Khách hàng nộp đơn khiếu nại đổi trả trong vòng 24h
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009..REQ-RENT-010
 */
export async function createRentalClaim(rentalOrderId, claimPayload) {
  return returnDisputeRequest(`/rental-disputes/orders/${rentalOrderId}/claim`, {
    method: 'POST',
    body: claimPayload,
  });
}

/**
 * CSKH phản hồi tiếp nhận/từ chối khiếu nại (SLA 72h)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-011
 */
export async function respondRentalClaim(disputeId, responsePayload) {
  return returnDisputeRequest(`/rental-disputes/${disputeId}/respond`, {
    method: 'PUT',
    body: responsePayload,
  });
}

/**
 * Kho showroom xác nhận đã nhận hàng hoàn về (Hạn chót 10 ngày)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-012
 */
export async function confirmReturnReceived(disputeId, trackingNumber = '') {
  return returnDisputeRequest(`/rental-disputes/${disputeId}/confirm-received`, {
    method: 'POST',
    body: { trackingNumber },
  });
}

/**
 * KCS kiểm duyệt chất lượng & hoàn tiền 100% hoặc tích điểm
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-011
 */
export async function completeDisputeKCS(disputeId, kcsPayload) {
  return returnDisputeRequest(`/rental-disputes/${disputeId}/kcs`, {
    method: 'POST',
    body: kcsPayload,
  });
}

/**
 * Lấy chi tiết phiếu khiếu nại đổi trả
 */
export async function getDisputeById(disputeId) {
  return returnDisputeRequest(`/rental-disputes/${disputeId}`, { method: 'GET' });
}
