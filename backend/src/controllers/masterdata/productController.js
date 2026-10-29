import { productService } from '../../services/masterdata/productService.js';
import { createCrudController } from '../../generic/crudController.js';
export const productController = createCrudController(productService);
