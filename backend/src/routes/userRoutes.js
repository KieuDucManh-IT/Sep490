import express from 'express';
import { 
  getUsers, 
  getUserById, 
  toggleLockUser, 
  getUserStats,
  createUser,
  updateUser,
  resetUserPassword
} from '../controllers/system/userController.js';

const router = express.Router();

router.get('/', getUsers);
router.get('/stats', getUserStats);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.patch('/:id/toggle-lock', toggleLockUser);
router.patch('/:id/reset-password', resetUserPassword);
router.post('/:id/reset-password', resetUserPassword);

export default router;
