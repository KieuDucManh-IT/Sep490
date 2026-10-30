import React from 'react';

export default function AccountToastContainer({ toasts = [], removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="admin-acc-toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`admin-acc-toast-item ${t.type === 'success' ? 'success' : t.type === 'error' ? 'error' : t.type === 'warning' ? 'warning' : 'info'}`}
        >
          <div className="admin-acc-toast-content">
            <span className="admin-acc-toast-icon">
              {t.type === 'success' && <i className="fa-solid fa-circle-check" />}
              {t.type === 'error' && <i className="fa-solid fa-circle-xmark" />}
              {t.type === 'warning' && <i className="fa-solid fa-triangle-exclamation" />}
              {(t.type === 'info' || (!['success', 'error', 'warning'].includes(t.type))) && (
                <i className="fa-solid fa-circle-info" />
              )}
            </span>
            <span className="admin-acc-toast-msg">{t.message}</span>
          </div>
          <button
            type="button"
            className="admin-acc-toast-close"
            onClick={() => removeToast(t.id)}
            title="Đóng thông báo"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      ))}
    </div>
  );
}

