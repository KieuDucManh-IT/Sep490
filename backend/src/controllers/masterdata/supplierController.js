import { supplierService } from '../../services/masterdata/supplierService.js';
import { createCrudController } from '../../generic/crudController.js';
export const supplierController = createCrudController(supplierService);
