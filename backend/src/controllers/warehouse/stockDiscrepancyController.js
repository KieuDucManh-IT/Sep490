import {
  countDiscrepancies, getDiscrepancy, listDiscrepancies, resolveDiscrepancy,
} from '../../services/warehouse/stockDiscrepancyService.js';

const handleError = (error, res, next) => {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'Mã phiếu chênh lệch đã tồn tại.' });
  return next(error);
};

export const listDiscrepancyRows = async (req, res, next) => {
  try { res.json({ success: true, data: await listDiscrepancies(req.user, req.query) }); }
  catch (error) { handleError(error, res, next); }
};
export const countDiscrepancyRows = async (req, res, next) => {
  try { res.json({ success: true, data: await countDiscrepancies(req.user, req.query) }); }
  catch (error) { handleError(error, res, next); }
};
export const getDiscrepancyRow = async (req, res, next) => {
  try { res.json({ success: true, data: await getDiscrepancy(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const resolveDiscrepancyRow = async (req, res, next) => {
  try { res.json({ success: true, data: await resolveDiscrepancy(req.params.id, req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
