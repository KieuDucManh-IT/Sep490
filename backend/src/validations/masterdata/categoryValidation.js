import { Category } from '../../models/masterdata/Category.js';
import { validateModelPayload } from './modelPayloadValidation.js';
export const validateCategory = (payload) => validateModelPayload(Category, payload);
