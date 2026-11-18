import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TryOnBottomBar({
  product,
  pairedGarment,
  pairedAccessory,
  resultImage,
  lastSavedImageUrl,
  isSavingWardrobe,
  onSaveToWardrobe,
}) {
  const navigate = useNavigate();

  const mainPrice = Number(product?.rentalPricePer3Days) || ((Number(product?.rentalPricePerDay) || 350000) * 3);
  const pairedPrice = pairedGarment ? ((Number(pairedGarment?.rentalPricePerDay) || 200000) * 3) : 0;
  const accessoryPrice = pairedAccessory ? ((Number(pairedAccessory?.rentalPricePerDay) || 150000) * 3) : 0;
  const totalEstimatedRental = mainPrice + pairedPrice + accessoryPrice;
  const totalItems = 1 + (pairedGarment ? 1 : 0) + (pairedAccessory ? 1 : 0);

  const isSaved = Boolean(resultImage) && lastSavedImageUrl === resultImage;

  return (
    <footer className="bottom-action-bar">
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '10px', color: '#6e7569' }}>Thời gian thuê gợi ý: </span>
          <strong style={{ fontSize: '13px', color: '#1f2421' }}>3 Ngày</strong>
        </div>
        <div style={{ borderLeft: '1px solid var(--color-border, #e2e6dc)', paddingLeft: '20px' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 600 }}>
            {totalItems > 1 ? `Giá thuê cả set (${totalItems} món): ` : 'Giá thuê dự kiến: '}
          </span>
          <strong style={{ fontSize: '16px', color: 'var(--color-gold, #5b6e4e)' }}>
            {totalEstimatedRental.toLocaleString('vi-VN')} đ
          </strong>
          {totalItems > 1 && (
            <span
              style={{
                fontSize: '9.5px',
                background: '#eaf2e6',
                color: 'var(--color-gold, #5b6e4e)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                marginLeft: '8px',
              }}
            >
              Set {totalItems} món hoàn chỉnh
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={onSaveToWardrobe}
          disabled={isSavingWardrobe || isSaved}
          style={{
            height: '34px',
            padding: '0 12px',
            fontSize: '11px',
            background: isSaved ? '#eaf2e6' : undefined,
            borderColor: isSaved ? 'var(--color-gold, #5b6e4e)' : undefined,
            color: isSaved ? 'var(--color-gold, #5b6e4e)' : '#1f2421',
            cursor: isSaved ? 'default' : 'pointer',
            opacity: isSavingWardrobe ? 0.7 : 1,
          }}
        >
          {isSavingWardrobe ? 'Đang lưu...' : isSaved ? '✓ Đã lưu tủ đồ' : 'Lưu tủ đồ'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ height: '34px', padding: '0 12px', fontSize: '11px' }}
          onClick={() => navigate('/wardrobe')}
        >
          Xem tủ đồ
        </button>
        <button
          type="button"
          className="btn-primary-rent"
          style={{ height: '34px', padding: '0 16px', fontSize: '11.5px' }}
          onClick={() => {
            if (product?._id && product._id !== 'sample-001') {
              navigate(`/product/${product._id}`);
            } else {
              navigate('/catalog');
            }
          }}
        >
          {totalItems > 1
            ? `Đặt thuê cả set (${totalItems} món) \u2192`
            : 'Đặt thuê sản phẩm này \u2192'}
        </button>
      </div>
    </footer>
  );
}
