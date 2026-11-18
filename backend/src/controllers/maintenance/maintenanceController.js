import {
  cancelMaintenance, completeMaintenance, createDisposal, createMaintenanceRecord, decideDisposal,
  getMaintenanceRecord, listDisposals, listMaintenanceCandidates, listMaintenanceRecords, listMaintenanceStaff, startMaintenance,
} from '../../services/maintenance/maintenanceService.js';
import {
  validateCancelMaintenance, validateCompleteMaintenance, validateCreateDisposal, validateCreateMaintenance, validateDecideDisposal,
} from '../../validations/maintenance/maintenanceValidation.js';

const handle = (work) => async (req, res, next) => {
  try { res.json({ success: true, data: await work(req) }); }
  catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Món hàng đã có phiếu đang mở.' });
    return next(error);
  }
};

export const listMaintenanceCandidateRows = handle((req) => listMaintenanceCandidates(req.user));
export const listMaintenanceStaffRows = handle((req) => listMaintenanceStaff(req.user));
export const listMaintenanceRows = handle((req) => listMaintenanceRecords(req.user, { status: String(req.query.status || '') }));
export const getMaintenanceRow = handle((req) => getMaintenanceRecord(req.params.id, req.user));
export const createMaintenanceRow = handle((req) => createMaintenanceRecord(req.user, validateCreateMaintenance(req.body)));
export const startMaintenanceRow = handle((req) => startMaintenance(req.params.id, req.user));
export const completeMaintenanceRow = handle((req) => completeMaintenance(req.params.id, req.user, validateCompleteMaintenance(req.body)));
export const cancelMaintenanceRow = handle((req) => cancelMaintenance(req.params.id, req.user, validateCancelMaintenance(req.body)));
export const listDisposalRows = handle((req) => listDisposals(req.user, { status: String(req.query.status || '') }));
export const createDisposalRow = handle((req) => createDisposal(req.user, validateCreateDisposal(req.body)));
export const decideDisposalRow = handle((req) => decideDisposal(req.params.id, req.user, validateDecideDisposal(req.body)));
