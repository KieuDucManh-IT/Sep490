import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { validateModelPayload } from './modelPayloadValidation.js';
export const validateProductVariant = (payload) => validateModelPayload(ProductVariant, payload);
