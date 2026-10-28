import React, { useEffect, useCallback } from 'react';
import { Modal, Button } from 'react-bootstrap';

/**
 * ImageLightboxModal - Fullscreen modal for viewing high-resolution images
 */
export default function ImageLightboxModal({ show, onHide, imageUrl, title = 'Xem Ảnh Kích Thước Thật' }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (show && e.key === 'Escape') {
        onHide();
      }
    },
    [show, onHide]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!imageUrl) return null;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      dialogClassName="image-lightbox-modal-dialog"
      contentClassName="border-0 shadow-lg"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(5, 10, 24, 0.85)' }}
    >
      <Modal.Header
        closeButton
        style={{
          background: '#0F172A',
          color: '#FFFFFF',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '14px 24px',
        }}
      >
        <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <div className="text-truncate">
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }} className="text-truncate">
              {title}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
              100% kích thước ảnh thật
            </div>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body
        style={{
          background: '#020617',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '360px',
          maxHeight: '82vh',
          overflow: 'auto',
        }}
        onClick={onHide}
      >
        <img
          src={imageUrl}
          alt={title}
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '76vh',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'default',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </Modal.Body>
    </Modal>
  );
}
