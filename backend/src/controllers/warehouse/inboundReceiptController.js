import {
  approveReceipt,
  cancelInboundReceipt,
  createInboundReceipt,
  getInboundReceipt,
  listInboundReceipts,
  listWarehouseStaff as getWarehouseStaff,
  putawayReceipt,
  recordReceipt,
} from '../../services/warehouse/inboundReceiptService.js';
import { isWarehouseStaff } from '../../services/warehouse/shared/roles.js';

const handleError = (error, res, next) => {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

export const listReceipts = async (req, res, next) => {
  try {
    const filters = isWarehouseStaff(req.user) ? { ...req.query, staffId: req.user._id } : req.query;
    res.json({ success: true, data: await listInboundReceipts(filters) });
  }
  catch (error) { handleError(error, res, next); }
};
export const getReceipt = async (req, res, next) => {
  try { res.json({ success: true, data: await getInboundReceipt(req.params.id, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const createReceipt = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await createInboundReceipt(req.body, req.user._id) }); }
  catch (error) { handleError(error, res, next); }
};
export const checkReceipt = async (req, res, next) => {
  try { res.json({ success: true, data: await recordReceipt(req.params.id, req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};
export const decideReceipt = async (req, res, next) => {
  // decision: 'approve' | 'recount' (kèm reason). 'reject' → 400 (validateReceiptDecision).
  try { res.json({ success: true, data: await approveReceipt(req.params.id, req.user._id, req.body) }); }
  catch (error) { handleError(error, res, next); }
};
export const putawayReceiptItems = async (req, res, next) => {
  try { res.json({ success: true, data: await putawayReceipt(req.params.id, req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};

export const cancelReceipt = async (req, res, next) => {
  try { res.json({ success: true, data: await cancelInboundReceipt(req.params.id, req.body, req.user) }); }
  catch (error) { handleError(error, res, next); }
};

export const listWarehouseStaff = async (req, res, next) => {
  try { res.json({ success: true, data: await getWarehouseStaff() }); }
  catch (error) { handleError(error, res, next); }
};
