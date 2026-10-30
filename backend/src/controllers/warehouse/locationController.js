import { inventoryLocationService, storageLocationService } from '../../services/warehouse/locationService.js';
import { createCrudController } from '../../generic/crudController.js';
export const inventoryLocationController = createCrudController(inventoryLocationService);
export const storageLocationController = createCrudController(storageLocationService);
