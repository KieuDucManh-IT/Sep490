import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function ImageLightbox({ imageUrl, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  return (
    <div className="chat-lightbox-overlay" onClick={onClose}>
      <button
        type="button"
        className="chat-lightbox-close"
        onClick={onClose}
        aria-label="Đóng ảnh"
      >
        <X size={22} />
      </button>
      <img
        src={imageUrl}
        alt="Phóng to ảnh"
        className="chat-lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

