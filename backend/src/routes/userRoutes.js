import express from 'express';
import { 
  getUsers, 
  getUserById, 
  toggleLockUser, 
  getUserStats 
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', getUsers);
router.get('/stats', getUserStats);
router.get('/:id', getUserById);
router.patch('/:id/toggle-lock', toggleLockUser);

export default router;
