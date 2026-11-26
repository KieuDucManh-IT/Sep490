import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchNotificationsApi,
  fetchUnreadCountApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationApi,
} from '../services/notificationApi';
import socketService from '../services/socket';

export const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [newToast, setNewToast] = useState(null);

  const toastTimeoutRef = useRef(null);

  // Load unread count
  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetchUnreadCountApi();
      if (res?.success) {
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      // Quiet fail if network interrupted
    }
  }, [user]);

  // Load notifications with pagination
  const fetchNotifications = useCallback(async ({ pageNum = 1, limit = 15, append = false } = {}) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetchNotificationsApi({ page: pageNum, limit });
      if (res?.success) {
        const list = res.notifications || res.data || [];
        setNotifications(prev => append ? [...prev, ...list] : list);
        setHasMore(list.length >= limit);
        setPage(pageNum);
        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.warn('Lỗi tải thông báo:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    if (!id) return;
    // Optimistic UI update
    setNotifications(prev =>
      prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await markNotificationReadApi(id);
    } catch (err) {
      console.warn('Lỗi đánh dấu đã đọc:', err.message);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    // Optimistic UI update
    setNotifications(prev =>
      prev.map(n => ({ ...n, isRead: true }))
    );
    setUnreadCount(0);

    try {
      await markAllNotificationsReadApi();
    } catch (err) {
      console.warn('Lỗi đánh dấu tất cả đã đọc:', err.message);
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (id) => {
    if (!id) return;
    const target = notifications.find(n => n._id === id);
    setNotifications(prev => prev.filter(n => n._id !== id));
    if (target && !target.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      await deleteNotificationApi(id);
    } catch (err) {
      console.warn('Lỗi xóa thông báo:', err.message);
    }
  }, [notifications]);

  // Real-time Socket.IO handler
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Initial fetch
    refreshUnreadCount();
    fetchNotifications({ pageNum: 1, limit: 15 });

    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewNotification = (data) => {
      if (!data) return;
      // Prepend to list
      setNotifications(prev => {
        if (prev.some(n => n._id === data._id)) return prev;
        return [data, ...prev];
      });
      setUnreadCount(prev => prev + 1);

      // Trigger ephemeral toast alert
      setNewToast(data);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setNewToast(null);
      }, 5000);
    };

    const handleReadNotification = ({ notificationId }) => {
      if (!notificationId) return;
      setNotifications(prev =>
        prev.map(n => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleReadAll = () => {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read', handleReadNotification);
    socket.on('notification:read-all', handleReadAll);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read', handleReadNotification);
      socket.off('notification:read-all', handleReadAll);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [user, refreshUnreadCount, fetchNotifications]);

  const value = {
    notifications,
    unreadCount,
    loading,
    hasMore,
    page,
    newToast,
    dismissToast: () => setNewToast(null),
    fetchNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification phải được sử dụng bên trong NotificationProvider');
  }
  return context;
}
