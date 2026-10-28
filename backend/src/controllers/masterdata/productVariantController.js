import { productVariantService } from '../../services/masterdata/productVariantService.js';
import { createCrudController } from '../crudController.js';
export const productVariantController = createCrudController(productVariantService);
