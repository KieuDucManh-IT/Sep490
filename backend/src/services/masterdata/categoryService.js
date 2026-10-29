import { Category } from '../../models/masterdata/Category.js';
import { validateCategory } from '../../validations/masterdata/categoryValidation.js';
import { createCrudService } from './createCrudService.js';
export const categoryService = createCrudService(Category, validateCategory, ['parentCategoryId']);
