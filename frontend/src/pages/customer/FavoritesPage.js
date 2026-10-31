import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import productService from '../../services/productService';
import '../../styles/Favorites.css';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const saved = localStorage.getItem('vestora_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Format currency
  const formatVND = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  };

  // Load products from backend matching favoriteIds
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadFavorites = async () => {
      try {
        const res = await productService.getProducts({ limit: 50 });
        if (isMounted && res?.data) {
          if (favoriteIds.length > 0) {
            const matched = res.data.filter((p) =>
              favoriteIds.includes(String(p._id)) ||
              favoriteIds.includes(String(p.productCode)) ||
              favoriteIds.includes(String(p.sku))
            );
            setProducts(matched);
          } else {
            setProducts([]);
          }
        }
      } catch (err) {
        console.error('Lỗi tải sản phẩm yêu thích:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFavorites();

    return () => {
      isMounted = false;
    };
  }, [favoriteIds]);

  // Remove single item from favorites
  const handleRemoveFavorite = (targetId) => {
    const updated = favoriteIds.filter((id) => id !== targetId);
    setFavoriteIds(updated);
    try {
      localStorage.setItem('vestora_favorites', JSON.stringify(updated));
      window.dispatchEvent(new Event('favoritesUpdated'));
    } catch {}
  };

  // Clear all favorites
  const handleClearAll = () => {
    setFavoriteIds([]);
    try {
      localStorage.removeItem('vestora_favorites');
      window.dispatchEvent(new Event('favoritesUpdated'));
    } catch {}
  };

  // Move all to cart
  const handleMoveAllToCart = () => {
    if (products.length === 0) return;
    try {
      const existingCart = JSON.parse(localStorage.getItem('vestora_cart') || '[]');
      products.forEach((p) => {
        const isRental =
          p.tag === 'rental' ||
          p.tag === 'rental' ||
          (p.rentalPricePer3Days && p.rentalPricePer3Days > 0) ||
          (p.rentalPricePerDay && p.rentalPricePerDay > 0);

        const price = isRental
          ? p.rentalPricePer3Days || (p.rentalPricePerDay ? p.rentalPricePerDay * 3 : 0)
          : p.salePrice || 0;

        const exists = existingCart.find((ci) => ci.productId === (p._id || p.productCode));
        if (exists) {
          exists.quantity += 1;
        } else {
          existingCart.push({
            id: `cart-${Date.now()}-${p._id || p.productCode}`,
            productId: p._id || p.productCode,
            name: p.name,
            shopName: p.shopId?.name || p.brand || 'Vestora Atelier',
            image: (p.images && p.images[0]) || p.image || '',
            size: (p.sizes && p.sizes[0]) || 'M',
            color: (p.colors && p.colors[0]) || 'Mặc định',
            colorCode: '#6e3eb3',
            duration: 3,
            startDate: new Date().toISOString().split('T')[0],
            endDate: '',
            price,
            deposit: p.deposit || Math.round(price * 2.5),
            quantity: 1,
            isRental,
            condition: p.condition || 'Rất tốt',
            inStock: p.inStock !== false,
            aiTryOn: p.aiTryOn !== false,
          });
        }
      });
      localStorage.setItem('vestora_cart', JSON.stringify(existingCart));
      window.dispatchEvent(new Event('cartUpdated'));
      navigate('/cart');
    } catch (err) {
      console.error(err);
    }
  };

  // Filter products by tab
  const filteredProducts = products.filter((p) => {
    const isRental =
      p.tag === 'rental' ||
      p.tag === 'rental' ||
      (p.rentalPricePer3Days && p.rentalPricePer3Days > 0) ||
      (p.rentalPricePerDay && p.rentalPricePerDay > 0);

    if (activeTab === 'rental') return isRental;
    if (activeTab === 'sale') return !isRental;
    return true;
  });

  return (
    <div className="favorites-page-container">
      <Navbar />

      {/* Header Banner */}
      <div className="fav-header-hero">
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', color: '#666', marginBottom: '8px' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>TRANG CHỦ</Link> &gt; DANH SÁCH YÊU THÍCH
        </div>
        <div style={{ fontSize: '10px', color: 'var(--color-gold-deep)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
          VESTORA SALON PRIVÉ ARCHIVE
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '38px', margin: '0 0 6px 0', color: '#1a1a1a' }}>
              Sản Phẩm Yêu Thích
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              Bạn có <strong>{products.length} sản phẩm</strong> đã lưu trong bộ sưu tập yêu thích
            </p>
          </div>

          {products.length > 0 && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-primary"
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={handleMoveAllToCart}
              >
                <i className="fa-solid fa-cart-shopping"></i> CHUYỂN TẤT CẢ VÀO GIỎ
              </button>
              <button
                className="btn-secondary"
                style={{ fontSize: '12px', cursor: 'pointer' }}
                onClick={handleClearAll}
              >
                XÓA TẤT CẢ
              </button>
            </div>
          )}
        </div>

        {/* Filter Tabs Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', borderTop: '1px solid #E5E7EB', paddingTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className={`category-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              TẤT CẢ ({products.length})
            </button>
            <button
              className={`category-tab-btn ${activeTab === 'rental' ? 'active' : ''}`}
              onClick={() => setActiveTab('rental')}
            >
              ĐỒ CHO THUÊ
            </button>
            <button
              className={`category-tab-btn ${activeTab === 'sale' ? 'active' : ''}`}
              onClick={() => setActiveTab('sale')}
            >
              MUA BÁN ĐỒ CŨ
            </button>
          </div>

          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
            <i className="fa-solid fa-shield-halved" style={{ marginRight: '4px' }}></i> BẢO CHỨNG ESCROW 100% KIỂM ĐỊNH
          </span>
        </div>
      </div>

      {/* Favorites Content */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 40px 60px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#71717a' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: '#9c7148', marginBottom: '12px' }}></i>
            <p>Đang tải danh sách trang phục yêu thích của bạn...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', background: '#faf8f5', borderRadius: '20px', margin: '20px 0' }}>
            <i className="fa-regular fa-heart" style={{ fontSize: '48px', color: '#d1c7bd', marginBottom: '16px' }}></i>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#2b2b2b', marginBottom: '8px' }}>
              Danh sách yêu thích đang trống
            </h3>
            <p style={{ fontSize: '13px', color: '#71717a', marginBottom: '24px' }}>
              Hãy nhấn vào biểu tượng trái tim ở bất kỳ trang phục nào trong bộ sưu tập để lưu vào đây.
            </p>
            <Link to="/catalog" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', padding: '10px 24px' }}>
              Khám phá bộ sưu tập ngay
            </Link>
          </div>
        ) : (
          <div className="fav-grid-container">
            {filteredProducts.map((item) => {
              const isRental =
                item.tag === 'rental' ||
                item.tag === 'rental' ||
                (item.rentalPricePer3Days && item.rentalPricePer3Days > 0) ||
                (item.rentalPricePerDay && item.rentalPricePerDay > 0);

              const price = isRental
                ? item.rentalPricePer3Days || (item.rentalPricePerDay ? item.rentalPricePerDay * 3 : 0)
                : item.salePrice || 0;

              const deposit = item.deposit || Math.round(price * 2.5);
              const imgUrl = (item.images && item.images[0]) || item.image || '';
              const targetId = item._id || item.productCode;

              return (
                <div key={targetId} className="product-card">
                  <div className="card-image-box">
                    <img src={imgUrl} alt={item.name} />
                    <span className="card-tag-badge">
                      {isRental ? 'THUÊ ĐỒ' : 'MUA BÁN'} {item.aiTryOn && '• ✨ AI'}
                    </span>
                    <button
                      className="card-fav-btn"
                      style={{ color: '#DC2626' }}
                      onClick={() => handleRemoveFavorite(targetId)}
                      title="Xóa khỏi yêu thích"
                    >
                      <i className="fa-solid fa-heart"></i>
                    </button>
                  </div>

                  <div className="card-content-body">
                    <div className="card-shop-name">
                      {item.shopId?.name || item.brand || 'VESTORA ATELIER'}
                    </div>
                    <Link to={`/product/${targetId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3 className="card-product-title" style={{ fontSize: '15px' }}>
                        {item.name}
                      </h3>
                    </Link>
                    <div className="card-price-row">
                      <span className="card-price-main">
                        {formatVND(price)}{' '}
                        {isRental && (
                          <small style={{ fontSize: '10px', color: '#666', fontWeight: 400 }}>
                            / 3 ngày
                          </small>
                        )}
                      </span>
                      {isRental && deposit > 0 && (
                        <span className="card-deposit-sub">Cọc: {formatVND(deposit)}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <Link
                        to={`/product/${targetId}`}
                        className="btn-primary"
                        style={{ flex: 1, textDecoration: 'none', textAlign: 'center', fontSize: '12px', padding: '8px 12px' }}
                      >
                        Xem chi tiết
                      </Link>
                      {item.aiTryOn && (
                        <button
                          className="card-btn-tryon"
                          onClick={() => navigate('/try-on/photo')}
                          title="Thử đồ AI"
                        >
                          ✨
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Privé Member Sync Banner */}
      <div style={{ maxWidth: '1280px', margin: '0 auto 60px', padding: '0 40px' }}>
        <div style={{ background: '#F5F3EF', borderRadius: '24px', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-gold-deep)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
              ĐẶC QUYỀN HỘI VIÊN VESTORA
            </div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '24px', margin: '0 0 6px 0' }}>
              Đồng Bộ Tủ Đồ Ảo Với Chuyên Gia Phong Cách
            </h2>
            <p style={{ fontSize: '13px', color: '#666', margin: 0, maxWidth: '640px' }}>
              Các sản phẩm lưu trong Danh Sách Yêu Thích sẽ được đồng bộ trực tiếp khi bạn đặt lịch thử đồ riêng tư tại Salon Privé hoặc tham vấn trực tuyến với Stylist.
            </p>
          </div>

          <button className="btn-primary" onClick={() => navigate('/try-on/photo')}>
            THỬ ĐỒ AI NGAY
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
