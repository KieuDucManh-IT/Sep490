import Notification from '../../models/system/Notification.js';
import User from '../../models/system/User.js';
import { getIO } from '../../socket/index.js';

/**
 * Kiểm tra xem thông báo có liên quan đến Đơn hàng / Đơn thuê / Đổi trả không
 */
export function isOrderNotification(notif = {}) {
  const type = String(notif.type || '').toLowerCase();
  const ref = String(notif.referenceType || '').toLowerCase();
  const link = String(notif.link || '').toLowerCase();

  if (
    type.startsWith('order') ||
    type.includes('rental') ||
    type === 'payment' ||
    type.includes('return')
  ) {
    return true;
  }

  if (
    ref.includes('order') ||
    ref.includes('rental') ||
    ref.includes('return')
  ) {
    return true;
  }

  if (
    link.includes('order') ||
    link.includes('rental') ||
    link.includes('return')
  ) {
    return true;
  }

  return false;
}

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
    // Admin chỉ quản lý tài khoản, tuyệt đối chặn không nhận thông báo về đơn hàng / đơn thuê
    if (isOrderNotification({ type, referenceType, link })) {
      const recipient = await User.findById(userId).select('Role role').lean();
      const rawRole = String(recipient?.Role || recipient?.role || '').trim().toLowerCase().replace(/[_\s-]/g, '');
      if (rawRole === 'admin') {
        return null;
      }
    }

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
 * Chuyển đổi danh sách role thành danh sách RegExp hỗ trợ đầy đủ các biến thể role
 * (VD: branch_manager vs branchmanager, shopOwner vs owner, etc.)
 */
export function getRoleRegexList(roles) {
  const roleList = Array.isArray(roles) ? roles : [roles];
  const regexes = [];

  for (const r of roleList) {
    if (!r) continue;
    const cleaned = String(r).trim().toLowerCase().replace(/[_\s-]/g, '');
    if (cleaned === 'branchmanager' || cleaned === 'brandmanager') {
      regexes.push(new RegExp('^(branch|brand)[\\s_-]?manager$', 'i'));
    } else if (cleaned === 'shopowner' || cleaned === 'owner') {
      regexes.push(new RegExp('^(shop[\\s_-]?owner|owner)$', 'i'));
    } else if (cleaned === 'warehousemanager') {
      regexes.push(new RegExp('^warehouse[\\s_-]?manager$', 'i'));
    } else if (cleaned === 'warehousestaff' || cleaned === 'warehouse') {
      regexes.push(new RegExp('^warehouse[\\s_-]?staff$', 'i'));
    } else if (cleaned === 'operationstaff' || cleaned === 'ops') {
      regexes.push(new RegExp('^operation[\\s_-]?staff$', 'i'));
    } else if (cleaned === 'admin') {
      regexes.push(new RegExp('^admin$', 'i'));
    } else if (cleaned === 'customer') {
      regexes.push(new RegExp('^customer$', 'i'));
    } else {
      regexes.push(new RegExp(`^${cleaned}$`, 'i'));
    }
  }

  return regexes;
}

/**
 * Điều hướng link phù hợp cho từng role để tránh lỗi phân quyền 403
 */
function resolveLinkForUser(userRole, notifData) {
  const cleanRole = String(userRole || '').trim().toLowerCase().replace(/[_\s-]/g, '');
  const linkByRole = notifData.linkByRole || {};

  if (linkByRole[cleanRole]) return linkByRole[cleanRole];
  if (linkByRole[userRole]) return linkByRole[userRole];

  const defaultLink = notifData.link || '';

  // Quản trị viên (Admin): chỉ quản lý tài khoản (/admin/accounts), không quản lý đơn hàng
  if (cleanRole === 'admin') {
    if (linkByRole.admin) return linkByRole.admin;
    return '/admin/accounts';
  }

  // Quản lý chi nhánh: điều hướng về /branch/*
  if (cleanRole === 'branchmanager') {
    if (linkByRole.branch_manager) return linkByRole.branch_manager;
    if (defaultLink.startsWith('/owner/rental-orders') || defaultLink.startsWith('/owner/orders')) {
      return '/branch/rental-orders';
    }
    if (defaultLink.startsWith('/owner/sale-orders')) {
      return '/branch/sale-orders';
    }
  }

  // Chủ shop: điều hướng về /owner/*
  if (cleanRole === 'shopowner' || cleanRole === 'owner') {
    if (linkByRole.shopOwner) return linkByRole.shopOwner;
    if (linkByRole.owner) return linkByRole.owner;
    if (defaultLink.startsWith('/branch/rental-orders')) {
      return '/owner/rental-orders';
    }
    if (defaultLink.startsWith('/branch/sale-orders')) {
      return '/owner/sale-orders';
    }
  }

  return defaultLink;
}

/**
 * Gửi thông báo tới một nhóm vai trò (VD: tất cả Admin, Shop Owner hoặc Branch Manager)
 * @param {string|string[]} roles - 'admin', 'shopOwner', 'branch_manager'...
 * @param {Object} notifData - Dữ liệu thông báo
 */
export async function notifyRoles(roles, notifData) {
  try {
    let roleList = Array.isArray(roles) ? roles : [roles];

    // Nếu thông báo liên quan đến đơn hàng, loại trừ hoàn toàn role admin vì admin chỉ quản lý tài khoản
    const isOrder = isOrderNotification(notifData);
    if (isOrder) {
      roleList = roleList.filter((r) => {
        const clean = String(r || '').trim().toLowerCase().replace(/[_\s-]/g, '');
        return clean !== 'admin';
      });
    }

    const roleRegexes = getRoleRegexList(roleList);
    if (!roleRegexes.length) return [];

    // Tìm tất cả người dùng thuộc các vai trò được chỉ định
    const users = await User.find({
      Role: { $in: roleRegexes },
      Status: { $in: ['active', 'ACTIVE'] }
    }).select('_id Role').lean();

    if (!users || users.length === 0) return [];

    // Lọc bỏ trùng lặp người dùng và đảm bảo loại bỏ role admin đối với đơn hàng
    const seenUsers = new Map();
    for (const u of users) {
      if (isOrder) {
        const clean = String(u.Role || '').trim().toLowerCase().replace(/[_\s-]/g, '');
        if (clean === 'admin') continue;
      }
      if (!seenUsers.has(String(u._id))) {
        seenUsers.set(String(u._id), u);
      }
    }

    // Lưu vào DB và phát socket cho từng người dùng
    const notifications = await Promise.all(
      Array.from(seenUsers.values()).map(u => {
        const link = resolveLinkForUser(u.Role, notifData);
        return createNotification({
          ...notifData,
          link,
          userId: u._id
        });
      })
    );

    return notifications.filter(Boolean);
  } catch (error) {
    console.error('[NotificationService] Lỗi khi gửi thông báo theo vai trò:', error.message);
    return [];
  }
}

/**
 * Lấy danh sách thông báo phân trang của người dùng
 */
export async function getUserNotifications(userId, { page = 1, limit = 20, isRead = null } = {}) {
  // Lấy role của user để loại trừ đơn hàng nếu là admin (admin chỉ quản lý account)
  const currentUser = await User.findById(userId).select('Role role').lean();
  const rawRole = String(currentUser?.Role || currentUser?.role || '').trim().toLowerCase().replace(/[_\s-]/g, '');

  const query = { userId };
  if (rawRole === 'admin') {
    query.type = { $nin: ['order_created', 'order_status', 'rental_due', 'payment', 'order_cancelled', 'order_completed', 'order_delayed', 'order_assigned', 'order_issue'] };
    query.referenceType = { $nin: ['Order', 'RentalOrder', 'SalesOrder', 'RentalReturn', 'RentalOrderDetail'] };
    query.link = { $not: /\b(order|rental|return)\b/i };
  }

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
    Notification.countDocuments({ ...query, isRead: false })
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
  const currentUser = await User.findById(userId).select('Role role').lean();
  const rawRole = String(currentUser?.Role || currentUser?.role || '').trim().toLowerCase().replace(/[_\s-]/g, '');

  const query = { userId, isRead: false };
  if (rawRole === 'admin') {
    query.type = { $nin: ['order_created', 'order_status', 'rental_due', 'payment', 'order_cancelled', 'order_completed', 'order_delayed', 'order_assigned', 'order_issue'] };
    query.referenceType = { $nin: ['Order', 'RentalOrder', 'SalesOrder', 'RentalReturn', 'RentalOrderDetail'] };
    query.link = { $not: /\b(order|rental|return)\b/i };
  }

  return Notification.countDocuments(query);
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
