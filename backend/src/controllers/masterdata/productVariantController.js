import { productVariantService } from '../../services/masterdata/productVariantService.js';
import { createCrudController } from '../../generic/crudController.js';
export const productVariantController = createCrudController(productVariantService);
