import { applyStockAdjustment, decideStockAdjustment, getStockAdjustment, listStockAdjustments } from '../../services/warehouse/stockAdjustmentService.js';
const respond = (fn) => async (req, res, next) => { try { res.json({ success: true, data: await fn(req) }); } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error); } };
export const listAdjustmentsRow = respond((req) => listStockAdjustments(req.query));
export const getAdjustmentRow = respond((req) => getStockAdjustment(req.params.id));
export const decideAdjustmentRow = respond((req) => decideStockAdjustment(req.params.id, req.user, req.body.decision, req.body.note));
export const applyAdjustmentRow = respond((req) => applyStockAdjustment(req.params.id, req.user));

