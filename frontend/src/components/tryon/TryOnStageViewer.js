import React from 'react';
import { Sparkles, Download } from 'lucide-react';

export default function TryOnStageViewer({
  userUploadedFile,
  activeModelImage,
  resultImage,
  isGenerating,
  generationStep,
  pairedAccessory,
  pairedGarment,
  pairedGarmentSize,
  selectedSize,
  category,
  fallbackImage,
}) {
  const totalItems = 1 + (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0);

  return (
    <div className="stage-viewport-card">
      <div className="stage-split-container">
        {/* Left Split Pane: Original Photo */}
        <div className="stage-split-pane">
          <div className="tryon-compare-badge badge-before">
            {userUploadedFile ? 'ẢNH BẠN TẢI LÊN' : 'ẢNH MẪU GỐC'}
          </div>
          <img
            src={activeModelImage}
            alt="Original Model"
            className="stage-split-image"
          />
        </div>

        {/* Right Split Pane: AI Try-On Result or Pending State */}
        <div className="stage-split-pane">
          {/* Scanning Overlay when AI is generating */}
          {isGenerating && (
            <div className="tryon-scan-overlay">
              <div className="tryon-scan-line" />
              <div className="tryon-status-overlay">
                <div className="tryon-spinner" />
                <span>{generationStep || 'AI IDM-VTON đang xử lý trang phục...'}</span>
              </div>
            </div>
          )}

          {resultImage ? (
            <>
              <div className="tryon-compare-badge badge-after">
                AI TRY-ON (KẾT QUẢ)
              </div>
              <img
                src={resultImage}
                alt="AI Try-On Result"
                className="stage-split-image"
              />
              {pairedAccessory && (
                <div
                  className="stage-accessory-card"
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid var(--color-gold, #5b6e4e)',
                    borderRadius: '9px',
                    padding: '5px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    boxShadow: '0 4px 12px rgba(31, 36, 33, 0.18)',
                    zIndex: 10,
                    maxWidth: '190px',
                  }}
                >
                  <img
                    src={
                      pairedAccessory.image ||
                      (Array.isArray(pairedAccessory.images) && pairedAccessory.images[0]) ||
                      fallbackImage
                    }
                    alt={pairedAccessory.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = fallbackImage;
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '5px',
                      objectFit: 'cover',
                      border: '1px solid #e2e6dc',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '8px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 700, textTransform: 'uppercase' }}>
                      👜 Phụ kiện set
                    </div>
                    <div
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        color: '#1f2421',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={pairedAccessory.name}
                    >
                      {pairedAccessory.name}
                    </div>
                    <div style={{ fontSize: '8.5px', color: '#6e7569', fontWeight: 600 }}>
                      +{(pairedAccessory.rentalPricePerDay || 150000).toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="stage-placeholder-pane">
              <Sparkles size={26} color="var(--color-gold, #5b6e4e)" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f2421', marginBottom: '3px' }}>
                KẾT QUẢ THỬ ĐỒ AI
              </div>
              <div style={{ fontSize: '10.5px', color: '#6e7569', maxWidth: '190px', lineHeight: 1.4 }}>
                Bấm <strong>"BẮT ĐẦU GHÉP ĐỒ AI"</strong> để xem trang phục kết xuất lên cơ thể
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Measurements & Download Control bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--color-border, #e2e6dc)',
          borderRadius: '9999px',
          padding: '5px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#1f2421',
          boxShadow: '0 2px 8px rgba(31, 36, 33, 0.08)',
          zIndex: 15,
        }}
      >
        <div>
          <span>Kích cỡ: <strong>Size {selectedSize}</strong></span>
          {pairedGarment && (
            <> &bull; <span>Món phối: <strong>Size {pairedGarmentSize}</strong></span></>
          )}
          {pairedAccessory && (
            <> &bull; <span>Phụ kiện: <strong>{pairedAccessory.name}</strong></span></>
          )} &bull;{' '}
          <span>Phân loại: <strong>
            {totalItems > 1
              ? `SET PHỐI (${totalItems} MÓN)`
              : category.toUpperCase()}
          </strong></span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {resultImage && (
            <a
              href={resultImage}
              target="_blank"
              rel="noreferrer"
              download="vestora-ai-tryon.png"
              className="btn-secondary"
              style={{
                height: '24px',
                fontSize: '10px',
                padding: '0 8px',
                textDecoration: 'none',
                color: '#1f2421',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Download size={11} />
              <span>Tải ảnh</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
