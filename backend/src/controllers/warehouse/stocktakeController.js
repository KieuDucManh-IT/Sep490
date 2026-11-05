import { approveStocktake, createStocktake, getStocktake, listStocktakes, listWarehouseStaffForStocktake, recordStocktakeCounts, startStocktake, submitStocktake } from '../../services/warehouse/stocktakeService.js';
const respond = (fn, status = 200) => async (req, res, next) => { try { res.status(status).json({ success: true, data: await fn(req) }); } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error); } };
export const listStocktakeStaff = respond(() => listWarehouseStaffForStocktake());
export const listStocktakesRow = respond((req) => listStocktakes(req.user, req.query));
export const createStocktakeRow = respond((req) => createStocktake(req.body, req.user), 201);
export const getStocktakeRow = respond((req) => getStocktake(req.params.id, req.user));
export const startStocktakeRow = respond((req) => startStocktake(req.params.id, req.user));
export const countStocktakeRow = respond((req) => recordStocktakeCounts(req.params.id, req.body, req.user));
export const submitStocktakeRow = respond((req) => submitStocktake(req.params.id, req.user));
export const approveStocktakeRow = respond((req) => approveStocktake(req.params.id, req.user));

