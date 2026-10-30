import { Category } from '../../models/masterdata/Category.js';
import { validateCategory } from '../../validations/masterdata/categoryValidation.js';
import { createCrudService } from '../../generic/crudService.js';
export const categoryService = createCrudService(Category, validateCategory, ['parentCategoryId']);
