import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/errorMiddleware.js';
import * as conversationController from '../controllers/conversationController.js';

const router = express.Router();

// Cấu hình Multer cho upload ảnh chat (Tối đa 5 file, mỗi file <= 5MB)
const chatImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file ảnh JPG, PNG hoặc WEBP'));
    }
    cb(null, true);
  },
});

// Tất cả các route đều yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Tạo hoặc lấy cuộc trò chuyện với Shop
router.post('/', conversationController.createOrGetConversation);

// 2. Lấy danh sách cuộc trò chuyện theo phân quyền (Customer / Shop Manager)
router.get('/', conversationController.getConversations);

// Lấy tổng số tin nhắn chưa đọc của người dùng (Đặt trước :id)
router.get('/unread-count', conversationController.getUnreadCountHttp);

// 3. Lấy thông tin chi tiết cuộc trò chuyện
router.get('/:id', conversationController.getConversationDetail);

// 4. Lấy lịch sử tin nhắn (hỗ trợ cursor-based pagination)
router.get('/:id/messages', conversationController.getConversationMessages);

// 5. Gửi tin nhắn qua HTTP
router.post('/:id/messages', conversationController.sendMessageHttp);

// 6. Đánh dấu đã đọc tin nhắn
router.post('/:id/read', conversationController.markAsReadHttp);

// 7. Tải ảnh lên phục vụ tư vấn
router.post('/:id/images', chatImageUpload.array('images', 5), conversationController.uploadChatImages);

// 8. Cập nhật trạng thái cuộc trò chuyện
router.patch('/:id/status', conversationController.updateConversationStatusHttp);

export default router;

