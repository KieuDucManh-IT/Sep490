import { categoryService } from '../../services/masterdata/categoryService.js';
import { createCrudController } from '../crudController.js';
export const categoryController = createCrudController(categoryService);
