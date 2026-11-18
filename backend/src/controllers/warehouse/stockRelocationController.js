import {
  cancelStockRelocation, completeStockRelocation, createStockRelocation,
  getStockRelocation, listRelocationStaff, listStockRelocations, startStockRelocation,
} from '../../services/warehouse/stockRelocationService.js';
import { validateCompleteStockRelocation, validateCreateStockRelocation } from '../../validations/warehouse/stockRelocationValidation.js';

const handle = (work) => async (req, res, next) => {
  try { res.json({ success: true, data: await work(req) }); }
  catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Mã phiếu di chuyển đã tồn tại.' });
    return next(error);
  }
};

export const listStockRelocationRows = handle((req) => listStockRelocations(req.user, req.query.operationType));
export const listStockRelocationStaffRows = handle(() => listRelocationStaff());
export const getStockRelocationRow = handle((req) => getStockRelocation(req.params.id, req.user));
export const createStockRelocationRow = handle((req) => createStockRelocation(req.body, req.user, validateCreateStockRelocation(req.body)));
export const startStockRelocationRow = handle((req) => startStockRelocation(req.params.id, req.user));
export const completeStockRelocationRow = handle((req) => completeStockRelocation(req.params.id, req.user, validateCompleteStockRelocation(req.body)));
export const cancelStockRelocationRow = handle((req) => cancelStockRelocation(req.params.id, req.user));
