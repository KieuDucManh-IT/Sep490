import React from 'react';
import { Sparkles, X } from 'lucide-react';

const TryOnOutfitPairing = ({
  pairedGarment,
  setPairedGarment,
  pairedGarmentSize,
  setPairedGarmentSize,
  pairedGarmentColor,
  setPairedGarmentColor,
  handleRemovePairedGarment,
  handleClearAllPaired,
  category,
  currentOutfitSuggestions = [],
  currentAccessorySuggestions = [],
  fallbackGarmentImage,
  autoCrop,
  setAutoCrop,
  hasPhotoConsent,
  setHasPhotoConsent,
  setErrorMessage,
  handleGenerateTryOn,
  isGenerating,
}) => {
  return (
    <>
      {/* Khối 1: GỢI Ý PHỐI TRANG PHỤC CÙNG SET (Áo / Quần / Chân váy ghép bằng AI IDM-VTON) */}
      <div
        style={{
          border: '1.5px dashed var(--color-gold, #5b6e4e)',
          background: 'rgba(91, 110, 78, 0.04)',
          borderRadius: '9px',
          padding: '8px 10px',
          marginTop: '2px',
        }}
      >
        {/* Header của khối phối trang phục */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sparkles size={12} color="var(--color-gold, #5b6e4e)" />
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: 'var(--color-gold, #5b6e4e)',
                letterSpacing: '0.4px',
              }}
            >
              GỢI Ý PHỐI TRANG PHỤC
            </span>
            {pairedGarment && (
              <span
                style={{
                  fontSize: '9px',
                  background: 'var(--color-gold, #5b6e4e)',
                  color: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: '99px',
                  fontWeight: 700,
                }}
              >
                1 món phối
              </span>
            )}
          </div>

          {pairedGarment && (
            <button
              type="button"
              onClick={handleClearAllPaired}
              style={{
                background: 'none',
                border: 'none',
                color: '#b91c1c',
                fontSize: '9.5px',
                cursor: 'pointer',
                fontWeight: 600,
                padding: 0,
              }}
            >
              ✕ Bỏ phối
            </button>
          )}
        </div>

        {/* Món trang phục ĐÃ ĐƯỢC CHỌN để ghép cùng */}
        {pairedGarment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
            <div
              style={{
                display: 'flex',
                gap: '7px',
                alignItems: 'center',
                background: '#ffffff',
                border: '1px solid var(--color-border, #e2e6dc)',
                borderRadius: '6px',
                padding: '4px 6px',
                position: 'relative',
              }}
            >
              <img
                src={
                  (pairedGarmentColor && pairedGarment?.colorImages?.[pairedGarmentColor]) ||
                  pairedGarment.primaryImageUrl ||
                  pairedGarment.image ||
                  pairedGarment.imageUrl ||
                  (Array.isArray(pairedGarment.images) && pairedGarment.images[0]) ||
                  fallbackGarmentImage
                }
                alt={pairedGarment.name}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = fallbackGarmentImage;
                }}
                style={{
                  width: '34px',
                  height: '42px',
                  borderRadius: '4px',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#1f2421',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {pairedGarment.name}
                </div>
                <div style={{ fontSize: '9.5px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
                  +{(pairedGarment.rentalPricePerDay || 200000).toLocaleString('vi-VN')} đ/ngày
                </div>
                {/* Chọn màu sắc cho món phối kèm */}
                {Array.isArray(pairedGarment?.colors) && pairedGarment.colors.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '8.5px', color: '#6e7569', fontWeight: 600 }}>Màu:</span>
                    {pairedGarment.colors.map((pclr) => {
                      const isSel = pairedGarmentColor === pclr || (!pairedGarmentColor && pclr === pairedGarment.colors[0]);
                      return (
                        <button
                          key={pclr}
                          type="button"
                          onClick={() => setPairedGarmentColor && setPairedGarmentColor(pclr)}
                          style={{
                            padding: '1px 5px',
                            fontSize: '8px',
                            borderRadius: '3px',
                            border: isSel ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid #dce1d5',
                            background: isSel ? 'var(--color-gold, #5b6e4e)' : '#f4f6f1',
                            color: isSel ? '#fff' : '#1f2421',
                            cursor: 'pointer',
                            fontWeight: isSel ? 700 : 500,
                          }}
                        >
                          {pclr}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontSize: '8.5px', color: '#6e7569', fontWeight: 600 }}>Size:</span>
                  {['XS', 'S', 'M', 'L'].map((bsz) => (
                    <button
                      key={bsz}
                      type="button"
                      onClick={() => setPairedGarmentSize(bsz)}
                      style={{
                        padding: '1px 4px',
                        fontSize: '8.5px',
                        borderRadius: '3px',
                        border:
                          pairedGarmentSize === bsz
                            ? '1px solid var(--color-gold, #5b6e4e)'
                            : '1px solid #dce1d5',
                        background:
                          pairedGarmentSize === bsz ? 'var(--color-gold, #5b6e4e)' : '#f4f6f1',
                        color: pairedGarmentSize === bsz ? '#fff' : '#1f2421',
                        cursor: 'pointer',
                        fontWeight: pairedGarmentSize === bsz ? 700 : 500,
                      }}
                    >
                      {bsz}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemovePairedGarment}
                title="Bỏ món này"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Tiêu đề danh mục trang phục phối */}
        <div style={{ fontSize: '9px', fontWeight: 700, color: '#4a5246', marginBottom: '5px' }}>
          {category === 'upper_body'
            ? 'Chọn Chân váy / Quần phối cùng:'
            : category === 'lower_body'
              ? 'Chọn Áo / Blazer phối cùng:'
              : 'Trang phục phối kèm gợi ý:'}
        </div>

        {/* Danh sách trang phục gợi ý cuộn ngang */}
        <div
          style={{
            display: 'flex',
            gap: '5px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
          }}
        >
          {currentOutfitSuggestions.slice(0, 15).map((item) => {
            const itemImg = item.image || (Array.isArray(item.images) && item.images[0]) || '';
            const isSelected = pairedGarment?._id === item._id;

            return (
              <div
                key={item._id || item.name}
                onClick={() => {
                  if (pairedGarment?._id === item._id) {
                    handleRemovePairedGarment();
                  } else {
                    setPairedGarment(item);
                    setPairedGarmentSize('S');
                  }
                }}
                style={{
                  flex: '0 0 68px',
                  cursor: 'pointer',
                  background: isSelected ? '#edf3e9' : '#ffffff',
                  border: isSelected
                    ? '1.5px solid var(--color-gold, #5b6e4e)'
                    : '1px solid var(--color-border, #e2e6dc)',
                  borderRadius: '5px',
                  padding: '3px',
                  textAlign: 'center',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 1px 4px rgba(91,110,78,0.2)' : 'none',
                }}
                title={`Bấm để ${isSelected ? 'bỏ chọn' : 'thêm vào set'}: ${item.name}`}
              >
                <img
                  src={itemImg || fallbackGarmentImage}
                  alt={item.name}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = fallbackGarmentImage;
                  }}
                  style={{
                    width: '100%',
                    height: '44px',
                    objectFit: 'cover',
                    borderRadius: '3px',
                  }}
                />
                <div
                  style={{
                    fontSize: '8.5px',
                    fontWeight: 600,
                    color: '#1f2421',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '2px',
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    fontSize: '8px',
                    color: isSelected ? 'var(--color-gold, #5b6e4e)' : '#6e7569',
                    fontWeight: 700,
                  }}
                >
                  {isSelected
                    ? '✓ Đang phối'
                    : `+ ${(item.rentalPricePerDay || 150000).toLocaleString('vi-VN')} đ`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Khối 2: GỢI Ý PHỤ KIỆN LOOKBOOK (Ảnh nhỏ Lookbook tham khảo - Không ghép thử đồ) */}
      {currentAccessorySuggestions && currentAccessorySuggestions.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border, #e2e6dc)',
            background: '#fafbf9',
            borderRadius: '9px',
            padding: '7px 9px',
            marginTop: '4px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '5px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '12px' }}>👜</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--color-gold, #5b6e4e)',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}
              >
                Phụ kiện Lookbook gợi ý
              </span>
            </div>
            <span style={{ fontSize: '8.5px', color: '#6e7569', fontStyle: 'italic' }}>
              Ảnh nhỏ Lookbook
            </span>
          </div>

          {/* Dải ảnh nhỏ phụ kiện lookbook cuộn ngang */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              scrollbarWidth: 'none',
            }}
          >
            {currentAccessorySuggestions.slice(0, 12).map((acc) => {
              const accImg =
                acc.primaryImageUrl ||
                acc.image ||
                (Array.isArray(acc.images) && acc.images[0]) ||
                fallbackGarmentImage;
              return (
                <a
                  key={acc._id || acc.id}
                  href={`/product/${acc._id || acc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: '0 0 58px',
                    background: '#ffffff',
                    border: '1px solid #e2e6dc',
                    borderRadius: '5px',
                    padding: '3px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Xem chi tiết phụ kiện: ${acc.name}`}
                >
                  <img
                    src={accImg}
                    alt={acc.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = fallbackGarmentImage;
                    }}
                    style={{
                      width: '100%',
                      height: '40px',
                      objectFit: 'cover',
                      borderRadius: '3px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '8px',
                      fontWeight: 600,
                      color: '#1f2421',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px',
                    }}
                  >
                    {acc.name}
                  </div>
                  <div style={{ fontSize: '7.5px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 700 }}>
                    {(acc.rentalPricePerDay || 100000).toLocaleString('vi-VN')} đ/ng
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto crop checkbox */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '10px',
          color: '#4a5246',
          background: '#f4f6f1',
          padding: '5px 8px',
          borderRadius: '6px',
          border: '1px solid var(--color-border, #e2e6dc)',
        }}
      >
        <input
          type="checkbox"
          id="autoCropCheck"
          checked={autoCrop}
          onChange={(e) => setAutoCrop(e.target.checked)}
          style={{ accentColor: 'var(--color-gold, #5b6e4e)', cursor: 'pointer', width: '13px', height: '13px' }}
        />
        <label htmlFor="autoCropCheck" style={{ cursor: 'pointer', fontWeight: 500 }}>
          Tự động cắt tỷ lệ 3:4 nếu ảnh người mẫu không chuẩn
        </label>
      </div>

      {/* Mandatory User Photo Consent Checkbox */}
      <div
        className={`tryon-consent-card ${hasPhotoConsent ? 'checked' : ''}`}
        style={{
          background: hasPhotoConsent ? '#eff4eb' : '#f8faf6',
          border: hasPhotoConsent
            ? '1px solid var(--color-gold, #5b6e4e)'
            : '1px solid var(--color-border, #e2e6dc)',
          borderRadius: '6px',
          padding: '6px 8px',
          transition: 'all 0.2s ease',
        }}
      >
        <label
          htmlFor="tryonPhotoConsent"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            id="tryonPhotoConsent"
            checked={hasPhotoConsent}
            onChange={(e) => {
              setHasPhotoConsent(e.target.checked);
              if (e.target.checked) setErrorMessage('');
            }}
            style={{
              marginTop: '1px',
              accentColor: 'var(--color-gold, #5b6e4e)',
              width: '14px',
              height: '14px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: '9.5px', color: '#2b332c', lineHeight: 1.35 }}>
            <strong style={{ color: 'var(--color-gold, #5b6e4e)' }}>Bảo mật:</strong> Đồng ý để VESTORA sử dụng hình ảnh thử đồ AI (Bảo mật 256-bit, không chia sẻ).
          </div>
        </label>
      </div>

      {/* AI Trigger Button */}
      <button
        type="button"
        className={`btn-generate-ai ${!hasPhotoConsent ? 'consent-locked' : ''}`}
        onClick={handleGenerateTryOn}
        disabled={isGenerating || !hasPhotoConsent}
        style={{ height: '36px', fontSize: '11.5px', borderRadius: '7px' }}
      >
        {isGenerating ? (
          <>
            <div className="tryon-spinner" />
            <span>ĐANG XỬ LÝ GHÉP ĐỒ AI...</span>
          </>
        ) : (
          <span>BẮT ĐẦU GHÉP ĐỒ AI</span>
        )}
      </button>

      {!hasPhotoConsent && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '9.5px',
            color: '#B45309',
            marginTop: '-2px',
            fontWeight: 500,
          }}
        >
          * Tích chọn đồng ý điều khoản ở trên để bắt đầu ghép đồ
        </div>
      )}
    </>
  );
};

export default TryOnOutfitPairing;
