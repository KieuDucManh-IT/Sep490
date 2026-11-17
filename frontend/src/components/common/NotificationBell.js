import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  UserPlus,
  ShoppingBag,
  Package,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import './NotificationBell.css';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay === 1) return 'Hôm qua';
  if (diffDay < 7) return `${diffDay} ngày trước`;

  return past.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getIconForType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('account') || t.includes('user')) {
    return {
      circleClass: 'account',
      icon: <UserPlus size={16} />,
    };
  }
  if (t.includes('order')) {
    return {
      circleClass: 'order',
      icon: <ShoppingBag size={16} />,
    };
  }
  if (t.includes('stock') || t.includes('warning') || t.includes('alert')) {
    return {
      circleClass: 'stock',
      icon: <AlertTriangle size={16} />,
    };
  }
  if (t.includes('success')) {
    return {
      circleClass: 'order',
      icon: <CheckCircle size={16} />,
    };
  }
  return {
    circleClass: 'system',
    icon: <Info size={16} />,
  };
}

export default function NotificationBell({
  buttonClassName = '',
  align = 'right',
  badgePosition = 'top-right',
  onCustomNavigate,
}) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    page,
    newToast,
    dismissToast,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotification();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle clicking on an individual notification
  const handleItemClick = (notif) => {
    if (!notif.isRead) {
      markAsRead(notif._id);
    }
    setIsOpen(false);

    if (notif.link) {
      if (typeof onCustomNavigate === 'function') {
        onCustomNavigate(notif.link);
      } else {
        navigate(notif.link);
      }
    }
  };

  const handleToastClick = () => {
    if (newToast) {
      if (newToast.link) {
        navigate(newToast.link);
      }
      dismissToast();
    }
  };

  return (
    <div className="vestora-notif-wrapper" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        className={`vestora-notif-btn ${buttonClassName} ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Thông báo hệ thống"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="vestora-notif-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div className={`vestora-notif-dropdown ${align === 'left' ? 'align-left' : ''}`}>
          {/* Header */}
          <div className="vestora-notif-header">
            <div className="vestora-notif-title-group">
              <h4 className="vestora-notif-title">Thông Báo</h4>
              {unreadCount > 0 && (
                <span className="vestora-notif-chip">{unreadCount} mới</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="vestora-notif-markall-btn"
                onClick={markAllAsRead}
              >
                Đã đọc tất cả
              </button>
            )}
          </div>

          {/* List */}
          <div className="vestora-notif-list">
            {notifications.length === 0 ? (
              <div className="vestora-notif-empty">
                <div className="vestora-notif-empty-icon">
                  <Bell size={28} />
                </div>
                <p className="vestora-notif-empty-text">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map((item) => {
                const { circleClass, icon } = getIconForType(item.type);
                return (
                  <div
                    key={item._id}
                    className={`vestora-notif-item ${!item.isRead ? 'unread' : ''}`}
                    onClick={() => handleItemClick(item)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={`vestora-notif-icon-circle ${circleClass}`}>
                      {icon}
                    </div>
                    <div className="vestora-notif-content">
                      <div className="vestora-notif-item-title">
                        <span>{item.title}</span>
                        {!item.isRead && <span className="vestora-notif-item-unread-dot" />}
                      </div>
                      <div className="vestora-notif-item-msg">{item.message}</div>
                      <span className="vestora-notif-item-time">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {hasMore && (
            <div className="vestora-notif-footer">
              <button
                type="button"
                className="vestora-notif-more-btn"
                disabled={loading}
                onClick={() => fetchNotifications({ pageNum: page + 1, limit: 15, append: true })}
              >
                {loading ? 'Đang tải...' : 'Xem thông báo cũ hơn'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Real-time Toast alert */}
      {newToast && (
        <div className="vestora-notif-toast" onClick={handleToastClick} role="alert">
          <div className="vestora-notif-icon-circle system" style={{ width: 30, height: 30 }}>
            <Bell size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="vestora-notif-toast-title">{newToast.title}</div>
            <p className="vestora-notif-toast-desc">{newToast.message}</p>
          </div>
          <button
            type="button"
            className="vestora-notif-toast-close"
            onClick={(e) => {
              e.stopPropagation();
              dismissToast();
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
