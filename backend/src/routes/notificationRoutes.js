import express from 'express';
import { authMiddleware } from '../middlewares/errorMiddleware.js';
import {
  getNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler
} from '../controllers/system/notificationController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getNotificationsHandler);
router.get('/unread-count', getUnreadCountHandler);
router.patch('/read-all', markAllAsReadHandler);
router.patch('/:id/read', markAsReadHandler);
router.delete('/:id', deleteNotificationHandler);

export default router;
