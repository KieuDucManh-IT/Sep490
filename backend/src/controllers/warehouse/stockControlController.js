import {
  applyStockAdjustment,
  approveStocktake,
  createStocktake,
  decideStockAdjustment,
  getStockAdjustment,
  getStocktake,
  listStockAdjustments,
  listStocktakes,
  listWarehouseStaffForStocktake,
  recordStocktakeCounts,
  startStocktake,
  submitStocktake,
} from '../../services/warehouse/stockControlService.js';

const handleError = (error, res, next) => {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'Mã phiếu đã tồn tại.' });
  return next(error);
};

export const listStocktakeRows = async (req, res, next) => {
  try { res.json({ success: true, data: await listStocktakes(req.user, req.query) }); }
  catch (error) { handleError(error, res, next); }
};
export const createStocktakeRow = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createStocktake(req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const getStocktakeRow = async (req, res, next) => {
  try { res.json({ success: true, data: await getStocktake(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const startStocktakeRow = async (req, res, next) => {
  try { res.json({ success: true, data: await startStocktake(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const countStocktakeRows = async (req, res, next) => {
  try { res.json({ success: true, data: await recordStocktakeCounts(req.params.id, req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const submitStocktakeRow = async (req, res, next) => {
  try { res.json({ success: true, data: await submitStocktake(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const approveStocktakeRow = async (req, res, next) => {
  try { res.json({ success: true, data: await approveStocktake(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};

export const listStockAdjustmentRows = async (req, res, next) => {
  try { res.json({ success: true, data: await listStockAdjustments(req.query) }); }
  catch (error) { handleError(error, res, next); }
};
export const getStockAdjustmentRow = async (req, res, next) => {
  try { res.json({ success: true, data: await getStockAdjustment(req.params.id) }); }
  catch (error) { handleError(error, res, next); }
};
export const decideStockAdjustmentRow = async (req, res, next) => {
  try { res.json({ success: true, data: await decideStockAdjustment(req.params.id, req.user, req.body.decision, req.body.note) }); }
  catch (error) { handleError(error, res, next); }
};
export const applyStockAdjustmentRow = async (req, res, next) => {
  try { res.json({ success: true, data: await applyStockAdjustment(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const listStocktakeStaff = async (req, res, next) => {
  try { res.json({ success: true, data: await listWarehouseStaffForStocktake() }); }
  catch (error) { handleError(error, res, next); }
};
