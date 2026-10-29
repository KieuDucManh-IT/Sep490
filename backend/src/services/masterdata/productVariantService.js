import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { validateProductVariant } from '../../validations/masterdata/productVariantValidation.js';
import { createCrudService } from '../../generic/crudService.js';
export const productVariantService = createCrudService(ProductVariant, validateProductVariant, ['productId']);
