import express from 'express';
import { inventoryLocationController, storageLocationController } from '../controllers/warehouse/locationController.js';
const router = express.Router();
const bindCrud = (path, controller) => {
  router.get(`/${path}`, controller.list);
  router.post(`/${path}`, controller.create);
  router.patch(`/${path}/:id`, controller.update);
  router.delete(`/${path}/:id`, controller.remove);
};
bindCrud('inventoryLocations', inventoryLocationController);
bindCrud('storageLocations', storageLocationController);
export default router;
