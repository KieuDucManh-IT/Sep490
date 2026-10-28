import { Product } from '../../models/masterdata/Product.js';
import { validateModelPayload } from './modelPayloadValidation.js';
export const validateProduct = (payload) => validateModelPayload(Product, payload);
