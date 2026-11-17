import React from 'react';

export default function AdminToastContainer({ toasts, onRemoveToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onRemoveToast(t.id)}
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            minWidth: '280px',
            maxWidth: '440px',
            padding: '12px 18px',
            borderRadius: '10px',
            color: '#FFFFFF',
            fontSize: '13.5px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.1)',
            background:
              t.type === 'success'
                ? 'linear-gradient(135deg, #065F46, #059669)'
                : t.type === 'error'
                  ? 'linear-gradient(135deg, #991B1B, #DC2626)'
                  : t.type === 'warning'
                    ? 'linear-gradient(135deg, #92400E, #D97706)'
                    : 'linear-gradient(135deg, #1E293B, #334155)',
            borderLeft: `5px solid ${t.type === 'success'
              ? '#34D399'
              : t.type === 'error'
                ? '#F87171'
                : t.type === 'warning'
                  ? '#FBBF24'
                  : '#60A5FA'
              }`,
            backdropFilter: 'blur(8px)'
          }}
        >
          <span style={{ lineHeight: 1.45 }}>{t.message}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveToast(t.id);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '17px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              flexShrink: 0
            }}
            title="Đóng thông báo"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
