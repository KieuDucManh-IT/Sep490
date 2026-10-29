import { Product } from '../../models/masterdata/Product.js';
import { validateProduct } from '../../validations/masterdata/productValidation.js';
import { createCrudService } from '../../generic/crudService.js';
export const productService = createCrudService(Product, validateProduct, ['categoryId']);
