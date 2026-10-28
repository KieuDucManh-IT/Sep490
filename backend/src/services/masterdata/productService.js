import { Product } from '../../models/masterdata/Product.js';
import { validateProduct } from '../../validations/masterdata/productValidation.js';
import { createCrudService } from './createCrudService.js';
export const productService = createCrudService(Product, validateProduct, ['categoryId']);
