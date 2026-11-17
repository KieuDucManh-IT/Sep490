import React from 'react';

export default function TryOnProductSelector({
  product,
  displayedCatalogProducts,
  productCategoryTabs,
  productCategoryTab,
  catalogLoading,
  category,
  selectedSize,
  garmentImageUrl,
  fallbackImage,
  onSelectProduct,
  onSelectCategoryTab,
  onChangeCategory,
  onSelectSize,
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--color-gold, #5b6e4e)' }}>
          BƯỚC 2
        </span>
        <span
          style={{
            fontSize: '10px',
            background: '#eaf2e6',
            color: 'var(--color-gold, #5b6e4e)',
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 700,
          }}
        >
          CHỌN & THỬ ĐỒ
        </span>
      </div>

      <h2 style={{ fontFamily: 'var(--font-title, sans-serif)', fontSize: '14px', fontWeight: 700, margin: 0, color: '#1f2421' }}>
        2. Trang Phục Đang Thử
      </h2>

      {/* Product Category Filter Tabs & Carousel */}
      <div>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            marginBottom: '4px',
            color: '#4a5246',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>DANH MỤC TRANG PHỤC</span>
          <span style={{ fontSize: '10px', color: '#6e7569', fontWeight: 500 }}>
            {displayedCatalogProducts.length} sản phẩm
          </span>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollbarWidth: 'none',
          }}
        >
          {productCategoryTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`category-pill-btn ${productCategoryTab === tab.id ? 'active' : ''}`}
              onClick={() => onSelectCategoryTab(tab.id)}
              style={{ height: '26px', padding: '0 8px', fontSize: '10px', borderRadius: '5px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Horizontal Mini Product Carousel */}
        <div
          className="tryon-products-carousel"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '4px 1px',
            marginTop: '2px',
          }}
        >
          {catalogLoading ? (
            <div style={{ fontSize: '10px', color: '#6e7569', padding: '6px 0' }}>
              Đang tải danh sách...
            </div>
          ) : displayedCatalogProducts.length === 0 ? (
            <div style={{ fontSize: '10px', color: '#6e7569', padding: '6px 0' }}>
              Không có sản phẩm trong danh mục này.
            </div>
          ) : (
            displayedCatalogProducts.map((p) => {
              const isSelected = p._id === product?._id;
              const pImg = p.image || (Array.isArray(p.images) && p.images[0]) || '';
              return (
                <div
                  key={p._id || p.name}
                  onClick={() => onSelectProduct(p)}
                  style={{
                    flex: '0 0 74px',
                    cursor: 'pointer',
                    background: isSelected ? '#f2f6ee' : '#ffffff',
                    border: isSelected ? '1.5px solid var(--color-gold, #5b6e4e)' : '1px solid var(--color-border, #e2e6dc)',
                    borderRadius: '7px',
                    padding: '3px',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    boxShadow: isSelected ? '0 2px 6px rgba(91, 110, 78, 0.15)' : 'none',
                  }}
                >
                  <img
                    src={pImg || fallbackImage}
                    alt={p.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = fallbackImage;
                    }}
                    style={{
                      width: '100%',
                      height: '52px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginBottom: '2px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '9.5px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? 'var(--color-gold, #5b6e4e)' : '#1f2421',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: '9px', color: '#6e7569', fontWeight: 600 }}>
                    {(p.rentalPricePerDay || 300000).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Item Card */}
      <div
        style={{
          background: '#f4f6f1',
          borderRadius: '8px',
          padding: '6px 8px',
          border: '1px solid var(--color-border, #e2e6dc)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <img
          src={garmentImageUrl || fallbackImage}
          alt={product?.name}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = fallbackImage;
          }}
          style={{
            width: '42px',
            height: '54px',
            borderRadius: '5px',
            objectFit: 'cover',
            border: '1px solid var(--color-border, #e2e6dc)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '9px', color: 'var(--color-gold, #5b6e4e)', fontWeight: 700, textTransform: 'uppercase' }}>
            {product?.brand || 'Vestora Atelier'}
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              margin: '1px 0',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#1f2421',
            }}
          >
            {product?.name || 'Trang phục cao cấp'}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-gold, #5b6e4e)' }}>
            {(product?.rentalPricePerDay || 350000).toLocaleString('vi-VN')} đ{' '}
            <small style={{ fontWeight: 400, fontSize: '9px', color: '#6e7569' }}>/ ngày</small>
          </div>
        </div>
      </div>

      {/* Category Picker (Đầm, Áo, Quần, Phụ kiện) */}
      <div>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            marginBottom: '3px',
            color: '#4a5246',
          }}
        >
          LOẠI TRANG PHỤC (AI CLASSIFICATION)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
          {[
            { id: 'dresses', label: 'Đầm / Cả bộ' },
            { id: 'upper_body', label: 'Áo / Thân trên' },
            { id: 'lower_body', label: 'Quần / Chân váy' },
            { id: 'accessories', label: 'Phụ kiện (Túi, Kính)' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              className={`category-pill-btn ${category === c.id ? 'active' : ''}`}
              onClick={() => onChangeCategory(c.id)}
              style={{
                height: '26px',
                fontSize: '10px',
                padding: '0 4px',
                borderRadius: '5px',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Size picker */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10px',
            marginBottom: '3px',
            color: '#4a5246',
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
            {category === 'upper_body' ? 'CHỌN KÍCH CỠ ÁO' : 'CHỌN KÍCH CỠ'}
          </span>
          <span style={{ color: 'var(--color-gold, #5b6e4e)', fontSize: '10px', fontWeight: 600 }}>
            Size: <strong>{selectedSize}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {((Array.isArray(product?.sizes) && product.sizes.length > 0)
            ? product.sizes
            : (Array.isArray(product?.availableSizes) && product.availableSizes.length > 0)
              ? product.availableSizes
              : (category === 'accessories' ? ['Freesize', 'Tiêu chuẩn'] : ['XS', 'S', 'M', 'L', 'XL'])
          ).map((s) => (
            <button
              key={s}
              type="button"
              className={`size-btn ${selectedSize === s ? 'active' : ''}`}
              style={{
                height: '26px',
                minWidth: '34px',
                padding: '0 6px',
                fontSize: '10.5px',
                background: selectedSize === s ? 'var(--color-gold, #5b6e4e)' : '#f4f6f1',
                color: selectedSize === s ? '#ffffff' : '#1f2421',
                border: selectedSize === s ? '1px solid var(--color-gold, #5b6e4e)' : '1px solid var(--color-border, #e2e6dc)',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: selectedSize === s ? 700 : 500,
                transition: 'all 0.2s ease',
              }}
              onClick={() => onSelectSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
