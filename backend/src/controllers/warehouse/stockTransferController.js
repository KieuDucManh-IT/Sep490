import {
  createTransferRequest,
  decideTransferRequest,
  getBranchTransferContext,
  getStockTransfer,
  listStockTransfers,
  receiveTransfer,
  shipTransfer,
} from '../../services/warehouse/stockTransferService.js';

const handleError = (error, res, next) => {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'Mã phiếu điều chuyển đã tồn tại.' });
  return next(error);
};

export const getBranchTransferContextRow = async (req, res, next) => {
  try { res.json({ success: true, data: await getBranchTransferContext(req.user, req.query.branchId) }); }
  catch (error) { handleError(error, res, next); }
};
export const listStockTransferRows = async (req, res, next) => {
  try { res.json({ success: true, data: await listStockTransfers(req.user, req.query) }); }
  catch (error) { handleError(error, res, next); }
};
export const createTransferRequestRow = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createTransferRequest(req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const getStockTransferRow = async (req, res, next) => {
  try { res.json({ success: true, data: await getStockTransfer(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const decideTransferRequestRow = async (req, res, next) => {
  try { res.json({ success: true, data: await decideTransferRequest(req.params.id, req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const shipTransferRow = async (req, res, next) => {
  try { res.json({ success: true, data: await shipTransfer(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const receiveTransferRow = async (req, res, next) => {
  try { res.json({ success: true, data: await receiveTransfer(req.params.id, req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
