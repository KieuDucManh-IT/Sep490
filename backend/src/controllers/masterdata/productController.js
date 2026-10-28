import { productService } from '../../services/masterdata/productService.js';
import { createCrudController } from '../crudController.js';
export const productController = createCrudController(productService);
