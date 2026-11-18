import React, { useState } from 'react';
import { Sparkles, Download, Layers, Eye, Check } from 'lucide-react';

export default function TryOnStageViewer({
  product,
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
  const [viewMode, setViewMode] = useState('model'); // 'model' | 'lookbook'
  const totalItems = 1 + (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0);

  const mainProductImg =
    product?.primaryImageUrl ||
    product?.image ||
    (Array.isArray(product?.images) && product.images[0]) ||
    fallbackImage;

  const pairedGarmentImg = pairedGarment
    ? pairedGarment.primaryImageUrl ||
      pairedGarment.image ||
      (Array.isArray(pairedGarment.images) && pairedGarment.images[0]) ||
      fallbackImage
    : null;

  const pairedAccessoryImg = pairedAccessory
    ? pairedAccessory.primaryImageUrl ||
      pairedAccessory.image ||
      (Array.isArray(pairedAccessory.images) && pairedAccessory.images[0]) ||
      fallbackImage
    : null;

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
              {/* Header Badges & View Switcher */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  right: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  zIndex: 12,
                }}
              >
                <div className="tryon-compare-badge badge-after" style={{ position: 'static' }}>
                  AI TRY-ON (KẾT QUẢ)
                </div>

                {pairedAccessory && (
                  <div
                    style={{
                      display: 'flex',
                      background: 'rgba(255, 255, 255, 0.92)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '20px',
                      padding: '2px',
                      border: '1px solid var(--color-border, #e2e6dc)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode('model')}
                      style={{
                        border: 'none',
                        background: viewMode === 'model' ? 'var(--color-gold, #5b6e4e)' : 'transparent',
                        color: viewMode === 'model' ? '#ffffff' : '#4a5246',
                        fontSize: '9.5px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Eye size={11} /> Người mẫu
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('lookbook')}
                      style={{
                        border: 'none',
                        background: viewMode === 'lookbook' ? 'var(--color-gold, #5b6e4e)' : 'transparent',
                        color: viewMode === 'lookbook' ? '#ffffff' : '#4a5246',
                        fontSize: '9.5px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      title="Xem toàn bộ bảng phối phong cách bao gồm trang phục và phụ kiện"
                    >
                      <Layers size={11} /> Set Lookbook
                    </button>
                  </div>
                )}
              </div>

              {/* View Mode 1: Model Full Image */}
              {viewMode === 'model' && (
                <>
                  <img
                    src={resultImage}
                    alt="AI Try-On Result"
                    className="stage-split-image"
                  />

                  {/* Floating Luxury Complete-The-Look Badge */}
                  {pairedAccessory && (
                    <div
                      className="stage-accessory-card"
                      onClick={() => setViewMode('lookbook')}
                      style={{
                        position: 'absolute',
                        bottom: '42px',
                        right: '10px',
                        background: 'rgba(255, 255, 255, 0.96)',
                        backdropFilter: 'blur(10px)',
                        border: '1.5px solid var(--color-gold, #5b6e4e)',
                        borderRadius: '10px',
                        padding: '6px 9px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 6px 18px rgba(31, 36, 33, 0.22)',
                        zIndex: 10,
                        maxWidth: '210px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease',
                      }}
                      title="Bấm để xem Bảng phối Lookbook hoàn chỉnh"
                    >
                      <img
                        src={pairedAccessoryImg}
                        alt={pairedAccessory.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = fallbackImage;
                        }}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '6px',
                          objectFit: 'cover',
                          border: '1px solid #e2e6dc',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '8px',
                            color: 'var(--color-gold, #5b6e4e)',
                            fontWeight: 800,
                            letterSpacing: '0.4px',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Sparkles size={9} /> Complete The Look
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
                          +{(pairedAccessory.rentalPricePerDay || 150000).toLocaleString('vi-VN')} đ/ngày
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* View Mode 2: Editorial Set Lookbook Moodboard Studio */}
              {viewMode === 'lookbook' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#f9faf7',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '38px 10px 42px 10px',
                    overflowY: 'auto',
                    zIndex: 9,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                      paddingBottom: '4px',
                      borderBottom: '1px solid #e2e6dc',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--color-gold, #5b6e4e)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                        VESTORA ATELIER LOOKBOOK
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#1f2421' }}>
                        Set Phối Hoàn Thiện ({totalItems} món)
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '9px',
                        background: '#eaf2e6',
                        color: 'var(--color-gold, #5b6e4e)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                      }}
                    >
                      STYLE COMPLETE
                    </span>
                  </div>

                  {/* Dual Grid: Model Try-On Photo on Left + Accessory & Garment Stack on Right */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', flex: 1, minHeight: 0 }}>
                    {/* Left: AI Try-On Result */}
                    <div
                      style={{
                        position: 'relative',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1.5px solid var(--color-gold, #5b6e4e)',
                        boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
                        background: '#000',
                      }}
                    >
                      <img
                        src={resultImage}
                        alt="AI Try-On Result"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          left: '6px',
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          fontSize: '8px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        ƯỚM TRÊN NGƯỜI
                      </div>
                    </div>

                    {/* Right: Outfit Elements & Accessories Stack */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Main Garment Card */}
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e6dc',
                          borderRadius: '6px',
                          padding: '6px',
                          display: 'flex',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <img
                          src={mainProductImg}
                          alt={product?.name}
                          style={{ width: '36px', height: '44px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '7.5px', color: '#6e7569', fontWeight: 700, textTransform: 'uppercase' }}>
                            Trang phục chính (Size {selectedSize})
                          </div>
                          <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#1f2421', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {product?.name || 'Trang phục cao cấp'}
                          </div>
                          <div style={{ fontSize: '9px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 700 }}>
                            {(product?.rentalPricePerDay || 350000).toLocaleString('vi-VN')} đ/ngày
                          </div>
                        </div>
                      </div>

                      {/* Paired Garment Card (if any) */}
                      {pairedGarment && (
                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e6dc',
                            borderRadius: '6px',
                            padding: '6px',
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center',
                          }}
                        >
                          <img
                            src={pairedGarmentImg}
                            alt={pairedGarment.name}
                            style={{ width: '36px', height: '44px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '7.5px', color: '#6e7569', fontWeight: 700, textTransform: 'uppercase' }}>
                              Món phối cùng (Size {pairedGarmentSize})
                            </div>
                            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#1f2421', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {pairedGarment.name}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 700 }}>
                              +{(pairedGarment.rentalPricePerDay || 200000).toLocaleString('vi-VN')} đ/ngày
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Highlighted Accessory Card */}
                      {pairedAccessory && (
                        <div
                          style={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f4f6f1 100%)',
                            border: '1.5px solid var(--color-gold, #5b6e4e)',
                            borderRadius: '6px',
                            padding: '6px',
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center',
                            boxShadow: '0 2px 6px rgba(91, 110, 78, 0.1)',
                          }}
                        >
                          <img
                            src={pairedAccessoryImg}
                            alt={pairedAccessory.name}
                            style={{ width: '36px', height: '44px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e6dc' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '7.5px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={9} /> Phụ kiện phối
                            </div>
                            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#1f2421', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {pairedAccessory.name}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 700 }}>
                              +{(pairedAccessory.rentalPricePerDay || 150000).toLocaleString('vi-VN')} đ/ngày
                            </div>
                          </div>
                        </div>
                      )}
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
              {pairedAccessory && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '5px 8px',
                    background: '#fcf8f2',
                    border: '1px solid #e8dfd0',
                    borderRadius: '6px',
                    fontSize: '9.5px',
                    color: '#8b6938',
                    maxWidth: '200px',
                  }}
                >
                  👜 Kèm phụ kiện: <strong>{pairedAccessory.name}</strong> trong Set Lookbook
                </div>
              )}
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
