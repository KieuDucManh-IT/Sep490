import {
  createBranchReturn,
  cancelBranchReturn,
  decideBranchReturn,
  decideBranchReturnReceipt,
  dispatchBranchReturn,
  getBranchReturn,
  listBranchReturnStaff,
  listBranchReturns,
  putawayBranchReturn,
  submitBranchReturnReceipt,
} from '../../services/warehouse/branchReturnService.js';

const handle = (work) => async (req, res, next) => {
  try { res.json({ success: true, data: await work(req) }); }
  catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Mã phiếu trả hàng đã tồn tại.' });
    return next(error);
  }
};

export const listBranchReturnRows = handle((req) => listBranchReturns(req.user));
export const getBranchReturnRow = handle((req) => getBranchReturn(req.params.id, req.user));
export const listBranchReturnStaffRows = handle(() => listBranchReturnStaff());
export const createBranchReturnRow = handle((req) => createBranchReturn(req.body, req.user));
export const decideBranchReturnRow = handle((req) => decideBranchReturn(req.params.id, req.body, req.user));
export const dispatchBranchReturnRow = handle((req) => dispatchBranchReturn(req.params.id, req.user));
export const cancelBranchReturnRow = handle((req) => cancelBranchReturn(req.params.id, req.user));
export const submitBranchReturnReceiptRow = handle((req) => submitBranchReturnReceipt(req.params.id, req.body, req.user));
export const decideBranchReturnReceiptRow = handle((req) => decideBranchReturnReceipt(req.params.id, req.body, req.user));
export const putawayBranchReturnRow = handle((req) => putawayBranchReturn(req.params.id, req.body, req.user));
