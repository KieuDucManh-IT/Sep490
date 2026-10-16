import express from 'express';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../controllers/categoryController.js';

const router = express.Router();

//duc 2026-10-16: CRUD endpoints cho Category model.
router.get('/', listCategories);
router.post('/', createCategory);
router.patch('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
