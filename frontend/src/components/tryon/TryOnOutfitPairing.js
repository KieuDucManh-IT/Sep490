import React from 'react';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';

const TryOnOutfitPairing = ({
  pairedGarment,
  setPairedGarment,
  pairedGarmentSize,
  setPairedGarmentSize,
  handleRemovePairedGarment,
  pairedAccessory,
  setPairedAccessory,
  handleRemovePairedAccessory,
  handleClearAllPaired,
  category,
  pairingTab,
  setPairingTab,
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
      {/* Khối Gợi Ý Phối Đồ & Combo Set */}
      <div
        style={{
          border: '1.5px dashed var(--color-gold, #5b6e4e)',
          background: 'rgba(91, 110, 78, 0.04)',
          borderRadius: '9px',
          padding: '8px 10px',
          marginTop: '2px',
        }}
      >
        {/* Header của khối gợi ý */}
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
              GỢI Ý PHỐI CẢ SET HOÀN CHỈNH
            </span>
            {(pairedGarment || pairedAccessory) && (
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
                {(pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0)} món phối
              </span>
            )}
          </div>

          {(pairedGarment || pairedAccessory) && (
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
              ✕ Bỏ tất cả phối
            </button>
          )}
        </div>

        {/* Các món ĐÃ ĐƯỢC CHỌN trong set */}
        {(pairedGarment || pairedAccessory) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
            {/* 1. Món quần / chân váy hoặc áo phối kèm */}
            {pairedGarment && (
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
                    pairedGarment.image ||
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
            )}

            {/* 2. Món phụ kiện túi xách phối kèm */}
            {pairedAccessory && (
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
                    pairedAccessory.image ||
                    (Array.isArray(pairedAccessory.images) && pairedAccessory.images[0]) ||
                    fallbackGarmentImage
                  }
                  alt={pairedAccessory.name}
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
                    {pairedAccessory.name}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
                    +{(pairedAccessory.rentalPricePerDay || 150000).toLocaleString('vi-VN')} đ/ngày
                  </div>
                  <span
                    style={{
                      fontSize: '8px',
                      background: '#f0f5ec',
                      color: 'var(--color-gold, #5b6e4e)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      fontWeight: 600,
                      display: 'inline-block',
                      marginTop: '2px',
                    }}
                  >
                    Túi xách phối kèm
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePairedAccessory}
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
            )}
          </div>
        )}

        {/* Tabs chuyển đổi danh mục gợi ý */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
          <button
            type="button"
            onClick={() => setPairingTab('outfit')}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: '9px',
              fontWeight: pairingTab === 'outfit' ? 700 : 500,
              borderRadius: '4px',
              border: pairingTab === 'outfit' ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid #dce1d5',
              background: pairingTab === 'outfit' ? 'var(--color-gold, #5b6e4e)' : '#ffffff',
              color: pairingTab === 'outfit' ? '#ffffff' : '#4a5246',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
            }}
          >
            {category === 'upper_body'
              ? ' Chân váy / Quần'
              : category === 'lower_body'
                ? ' Áo / Blazer'
                : ' Trang phục phối'}
            {pairedGarment && (
              <CheckCircle2 size={10} color={pairingTab === 'outfit' ? '#fff' : 'var(--color-gold, #5b6e4e)'} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPairingTab('accessory')}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: '9px',
              fontWeight: pairingTab === 'accessory' ? 700 : 500,
              borderRadius: '4px',
              border: pairingTab === 'accessory' ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid #dce1d5',
              background: pairingTab === 'accessory' ? 'var(--color-gold, #5b6e4e)' : '#ffffff',
              color: pairingTab === 'accessory' ? '#ffffff' : '#4a5246',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
            }}
          >
            Túi xách phối kèm
            {pairedAccessory && (
              <CheckCircle2 size={10} color={pairingTab === 'accessory' ? '#fff' : 'var(--color-gold, #5b6e4e)'} />
            )}
          </button>
        </div>

        {/* Danh sách sản phẩm gợi ý cuộn ngang */}
        <div
          style={{
            display: 'flex',
            gap: '5px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
          }}
        >
          {(pairingTab === 'outfit' ? currentOutfitSuggestions : currentAccessorySuggestions)
            .slice(0, 15)
            .map((item) => {
              const itemImg = item.image || (Array.isArray(item.images) && item.images[0]) || '';
              const isSelected = pairedGarment?._id === item._id || pairedAccessory?._id === item._id;

              return (
                <div
                  key={item._id || item.name}
                  onClick={() => {
                    if (pairingTab === 'outfit') {
                      if (pairedGarment?._id === item._id) {
                        handleRemovePairedGarment();
                      } else {
                        setPairedGarment(item);
                        setPairedGarmentSize('S');
                      }
                    } else {
                      if (pairedAccessory?._id === item._id) {
                        handleRemovePairedAccessory();
                      } else {
                        setPairedAccessory(item);
                      }
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
