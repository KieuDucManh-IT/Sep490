import express from 'express';
import { 
  getUsers, 
  getUserById, 
  toggleLockUser, 
  getUserStats,
  createUser,
  updateUser
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', getUsers);
router.get('/stats', getUserStats);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.patch('/:id/toggle-lock', toggleLockUser);

export default router;
