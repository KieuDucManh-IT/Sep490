import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  cancelMaintenanceRow, completeMaintenanceRow, createDisposalRow, createMaintenanceRow, decideDisposalRow,
  getMaintenanceRow, listDisposalRows, listMaintenanceCandidateRows, listMaintenanceRows, listMaintenanceStaffRows, startMaintenanceRow,
} from '../controllers/maintenance/maintenanceController.js';

// Mount tại /api/warehouse/maintenance
export const maintenanceRouter = express.Router();
maintenanceRouter.use(authMiddleware);
maintenanceRouter.get('/candidates', requireRoles('warehouse_manager', 'admin'), listMaintenanceCandidateRows);
maintenanceRouter.get('/staff', requireRoles('warehouse_manager', 'admin'), listMaintenanceStaffRows);
maintenanceRouter.get('/', requireRoles('warehouse_manager', 'warehouse_staff', 'admin'), listMaintenanceRows);
maintenanceRouter.post('/', requireRoles('warehouse_manager', 'admin'), createMaintenanceRow);
maintenanceRouter.get('/:id', requireRoles('warehouse_manager', 'warehouse_staff', 'admin'), getMaintenanceRow);
maintenanceRouter.post('/:id/start', requireRoles('warehouse_staff', 'warehouse_manager', 'admin'), startMaintenanceRow);
maintenanceRouter.post('/:id/complete', requireRoles('warehouse_staff', 'warehouse_manager', 'admin'), completeMaintenanceRow);
maintenanceRouter.post('/:id/cancel', requireRoles('warehouse_manager', 'admin'), cancelMaintenanceRow);

// Mount tại /api/warehouse/disposals
export const disposalRouter = express.Router();
disposalRouter.use(authMiddleware);
disposalRouter.get('/', requireRoles('warehouse_manager', 'admin'), listDisposalRows);
disposalRouter.post('/', requireRoles('warehouse_manager', 'admin'), createDisposalRow);
disposalRouter.post('/:id/decision', requireRoles('warehouse_manager', 'admin'), decideDisposalRow);

export default maintenanceRouter;
