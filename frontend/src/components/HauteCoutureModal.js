/**
 * Haute Couture Modal Component
 * Zero-Native Dialogs (no window.alert / confirm)
 * Zero-Emoji (100% SVG Vector Icons from lucide-react)
 * Haute Couture Design Tokens (#171717, #C5A880, #F8F7F4, #E5E0D8)
 * @ears .sdd/features/rental-orders/SPEC.md#NFR-UI-001
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function HauteCoutureModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '560px',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(23, 23, 23, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth,
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E5E0D8',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #F1ECE4',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#FCFAF8',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: 'serif',
                color: '#171717',
                letterSpacing: '0.02em',
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '13px',
                  color: '#78716C',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#78716C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F5F5F4')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            fontSize: '14px',
            color: '#292524',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
