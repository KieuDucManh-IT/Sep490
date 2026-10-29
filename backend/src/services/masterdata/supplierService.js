import { Supplier } from '../../models/masterdata/Supplier.js';
import { validateSupplier } from '../../validations/masterdata/supplierValidation.js';
import { createCrudService } from '../../generic/crudService.js';
export const supplierService = createCrudService(Supplier, validateSupplier);
