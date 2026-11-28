import { randomUUID } from 'node:crypto';
import { authMiddleware } from '../../middlewares/errorMiddleware.js';
import { getOwnerPerformanceReport } from '../../services/shop/owner-performance-service.js';
const CONTEXT = Symbol('owner-performance-request');
const ERRORS = {
  ERR_UNAUTHENTICATED: [401, 'Bạn cần đăng nhập để xem báo cáo.'],
  ERR_OWNER_REPORT_FORBIDDEN: [403, 'Bạn không có quyền xem báo cáo chủ shop.'],
  ERR_OWNER_REPORT_QUERY: [400, 'Bộ lọc báo cáo không hợp lệ.'],
  ERR_OWNER_REPORT_TIME: [500, 'Không thể xác minh thời điểm báo cáo.'],
  ERR_OWNER_REPORT_SOURCE: [500, 'Không thể tải báo cáo chủ shop.'],
};

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017 */
function requestContext(req) {
  if (!req[CONTEXT]) req[CONTEXT] = Object.freeze({ request_id: randomUUID(), timestamp: new Date().toISOString() });
  return req[CONTEXT];
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017 */
function sendError(req, res, failure) {
  if (res.headersSent) return;
  const code = Object.hasOwn(ERRORS, failure?.code || '') ? failure.code : 'ERR_OWNER_REPORT_SOURCE';
  const [status, message] = ERRORS[code];
  return res.status(status).json({ error_code: code, message, ...requestContext(req) });
}

/**
 * Invoke the existing authentication mechanism with an endpoint-local response
 * facade: no mutation of shared middleware or global res.json/error handler.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-002
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017
 */
export function createOwnerPerformanceAuthentication({ authenticate = authMiddleware } = {}) {
  return async function ownerPerformanceAuthentication(req, res, next) {
    requestContext(req);
    const facade = { status(status) { return { json() {
      const code = status === 401 ? 'ERR_UNAUTHENTICATED' : status === 403 ? 'ERR_OWNER_REPORT_FORBIDDEN' : 'ERR_OWNER_REPORT_SOURCE';
      return sendError(req, res, { code });
    } }; } };
    try {
      await authenticate(req, facade, (failure) => failure ? sendError(req, res, failure) : next());
    } catch (failure) {
      return sendError(req, res, failure);
    }
  };
}

/**
 * Only authenticated server identity and query reach the approved service.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-001
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017
 */
export function createOwnerPerformanceController({ reportService = getOwnerPerformanceReport } = {}) {
  return async function getOwnerPerformanceReportController(req, res) {
    try {
      const payload = await reportService({ user: req.user, query: req.query || {} });
      if (payload?.success !== true || !payload.data) throw new Error('Unavailable report');
      return res.status(200).json(payload);
    } catch (failure) {
      return sendError(req, res, failure);
    }
  };
}

export const ownerPerformanceAuthentication = createOwnerPerformanceAuthentication();
export const getOwnerPerformanceReportController = createOwnerPerformanceController();
