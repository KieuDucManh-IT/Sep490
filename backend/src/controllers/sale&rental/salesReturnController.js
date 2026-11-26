/**
 * Sales Return Controller (TASK-015) — trả hàng bán theo món.
 * Lỗi nghiệp vụ mang `status`/`statusCode` → trả đúng mã; lỗi khác chuyển cho errorMiddleware.
 */
import * as salesReturnService from '../../services/sale&rental/salesReturnService.js';

const sendError = (res, next, error) => {
  const status = error.status || error.statusCode;
  if (status) return res.status(status).json({ success: false, message: error.message });
  return next(error);
};

/** GET /api/sales-orders/:id/returns — danh sách phiếu trả của đơn. */
export const listReturns = async (req, res, next) => {
  try {
    const data = await salesReturnService.listSalesReturns(req.params.id, req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, next, error);
  }
};

/** GET /api/sales-orders/:id/returnable-items — món còn trả được, theo dòng đơn. */
export const getReturnableItems = async (req, res, next) => {
  try {
    const data = await salesReturnService.getReturnableItems(req.params.id, req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, next, error);
  }
};

/** POST /api/sales-orders/:id/returns — tạo phiếu trả theo món và nhập lại kho chi nhánh. */
export const createReturn = async (req, res, next) => {
  try {
    const data = await salesReturnService.createSalesReturn(req.params.id, req.body, req.user);
    return res.status(201).json({ success: true, message: 'Đã ghi nhận trả hàng.', data });
  } catch (error) {
    return sendError(res, next, error);
  }
};
