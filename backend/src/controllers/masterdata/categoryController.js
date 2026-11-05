import { categoryService } from '../../services/masterdata/categoryService.js';
import { createCrudController } from '../../generic/crudController.js';
export const categoryController = createCrudController(categoryService);
