import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '../../services/system/notificationService.js';

export const getNotificationsHandler = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page, limit, isRead } = req.query;
    const result = await getUserNotifications(userId, { page, limit, isRead });

    res.json({
      success: true,
      data: result.notifications,
      notifications: result.notifications,
      total: result.total,
      unreadCount: result.unreadCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCountHandler = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const unreadCount = await getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

export const markAsReadHandler = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const updated = await markAsRead(id, userId);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo hoặc bạn không có quyền thao tác'
      });
    }

    res.json({
      success: true,
      message: 'Đã đánh dấu thông báo là đã đọc',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsReadHandler = async (req, res, next) => {
  try {
    const userId = req.user._id;
    await markAllAsRead(userId);

    res.json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotificationHandler = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const success = await deleteNotification(id, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo cần xóa'
      });
    }

    res.json({
      success: true,
      message: 'Đã xóa thông báo thành công'
    });
  } catch (error) {
    next(error);
  }
};
