import Notification from '../../models/system/Notification.js';
import User from '../../models/system/User.js';
import { getIO } from '../../socket/index.js';

/**
 * Gửi thông báo tới 1 người dùng cụ thể
 * @param {Object} payload
 * @param {string} payload.userId - ID người nhận
 * @param {string} payload.title - Tiêu đề
 * @param {string} payload.message - Nội dung chi tiết
 * @param {string} [payload.type='system'] - Loại: 'account_created', 'order_created', 'order_status', 'rental_due', 'payment', 'system'
 * @param {string} [payload.link=''] - Đường dẫn điều hướng khi click
 * @param {string} [payload.referenceType=''] - Tham chiếu model (Order, User, Shop...)
 * @param {string} [payload.referenceId=null] - ID bản ghi tham chiếu
 * @param {Object} [payload.metadata={}] - Dữ liệu mở rộng
 */
export async function createNotification({
  userId,
  title,
  message,
  type = 'system',
  link = '',
  referenceType = '',
  referenceId = null,
  metadata = {}
}) {
  if (!userId) return null;

  try {
    const notification = await Notification.create({
      userId,
      title: title.trim(),
      message: message.trim(),
      type,
      link: link.trim(),
      referenceType,
      referenceId: referenceId || null,
      metadata,
      isRead: false
    });

    // Phát tín hiệu real-time qua Socket.IO tới đúng phòng của người dùng
    const io = getIO();
    if (io) {
      io.to(`user:${String(userId)}`).emit('notification:new', notification);
    }

    return notification;
  } catch (error) {
    console.error('[NotificationService] Lỗi khi tạo thông báo:', error.message);
    return null;
  }
}

/**
 * Gửi thông báo tới một nhóm vai trò (VD: tất cả Admin hoặc Shop Owner)
 * @param {string|string[]} roles - 'admin', 'shopOwner', 'branch_manager'...
 * @param {Object} notifData - Dữ liệu thông báo
 */
export async function notifyRoles(roles, notifData) {
  try {
    const roleList = Array.isArray(roles) ? roles : [roles];
    const normalizedRegex = roleList.map(r => new RegExp(`^${r.replace(/[_\s-]/g, '')}$`, 'i'));

    // Tìm tất cả người dùng thuộc các vai trò được chỉ định
    const users = await User.find({
      Role: { $in: normalizedRegex },
      Status: { $in: ['active', 'ACTIVE'] }
    }).select('_id Role').lean();

    if (!users || users.length === 0) return [];

    // Lưu vào DB cho từng người dùng
    const notifications = await Promise.all(
      users.map(u =>
        createNotification({
          ...notifData,
          userId: u._id
        })
      )
    );

    return notifications;
  } catch (error) {
    console.error('[NotificationService] Lỗi khi gửi thông báo theo vai trò:', error.message);
    return [];
  }
}

/**
 * Lấy danh sách thông báo phân trang của người dùng
 */
export async function getUserNotifications(userId, { page = 1, limit = 20, isRead = null } = {}) {
  const query = { userId };
  if (isRead !== null) {
    query.isRead = isRead === true || isRead === 'true';
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (p - 1) * l;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, isRead: false })
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l) || 1
  };
}

/**
 * Đếm số lượng thông báo chưa đọc
 */
export async function getUnreadCount(userId) {
  return Notification.countDocuments({ userId, isRead: false });
}

/**
 * Đánh dấu 1 thông báo là đã đọc
 */
export async function markAsRead(notificationId, userId) {
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  ).lean();

  if (updated) {
    const io = getIO();
    if (io) {
      io.to(`user:${String(userId)}`).emit('notification:read', { notificationId });
    }
  }

  return updated;
}

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc
 */
export async function markAllAsRead(userId) {
  await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  const io = getIO();
  if (io) {
    io.to(`user:${String(userId)}`).emit('notification:read-all');
  }

  return { success: true };
}

/**
 * Xóa 1 thông báo
 */
export async function deleteNotification(notificationId, userId) {
  const deleted = await Notification.findOneAndDelete({ _id: notificationId, userId });
  return Boolean(deleted);
}
