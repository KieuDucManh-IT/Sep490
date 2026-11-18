import {
  getCentralWarehouseSettings, inventoryLocationService, storageLocationService,
} from '../../services/warehouse/locationService.js';
import { createCrudController } from '../../generic/crudController.js';

const inventoryCrud = createCrudController(inventoryLocationService);

const sendError = (error, res, next) => (error.statusCode
  ? res.status(error.statusCode).json({ success: false, message: error.message })
  : next(error));

export const inventoryLocationController = {
  ...inventoryCrud,
  // Truyền người dùng để service giới hạn Quản lý kho chỉ sửa kho tổng (TASK-014 A1).
  update: async (req, res, next) => {
    try {
      const data = await inventoryLocationService.update(req.params.id, req.body, req.user);
      if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu.' });
      return res.json({ success: true, data });
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        return res.status(400).json({ success: false, message: error.message });
      }
      return sendError(error, res, next);
    }
  },
  central: async (req, res, next) => {
    try { res.json({ success: true, data: await getCentralWarehouseSettings() }); }
    catch (error) { sendError(error, res, next); }
  },
};

export const storageLocationController = createCrudController(storageLocationService);
