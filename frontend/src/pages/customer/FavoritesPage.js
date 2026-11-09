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
    } catch { }
  };

  // Clear all favorites
  const handleClearAll = () => {
    if (window.confirm('Bạn có chắc muốn xóa tất cả sản phẩm khỏi danh sách yêu thích?')) {
      setFavoriteIds([]);
      try {
        localStorage.removeItem('vestora_favorites');
        window.dispatchEvent(new Event('favoritesUpdated'));
      } catch { }
    }
  };

  // Move all to cart
  const handleMoveAllToCart = () => {
    if (products.length === 0) return;
    try {
      const existingCart = JSON.parse(localStorage.getItem('vestora_cart') || '[]');
      products.forEach((p) => {
        const isRental =
          p.tag === 'rental' ||
          (p.rentalPricePer3Days && p.rentalPricePer3Days > 0) ||
          (p.rentalPricePerDay && p.rentalPricePerDay > 0);

        const price = isRental
          ? p.rentalPricePerDay || (p.rentalPricePer3Days ? Math.round(p.rentalPricePer3Days / 3) : 0)
          : p.salePrice || 0;

        const exists = existingCart.find((ci) => ci.productId === (p._id || p.productCode));
        if (exists) {
          exists.quantity += 1;
        } else {
          existingCart.push({
            id: `cart-${Date.now()}-${p._id || p.productCode}`,
            productId: p._id || p.productCode,
            name: p.name,
            shopName: p.shopId?.name || p.brand || 'VESTORA ATELIER',
            image: (p.images && p.images[0]?.imageUrl) || p.image || p.imageUrl || '',
            size: (p.sizes && p.sizes[0]) || 'M',
            color: (p.colors && p.colors[0]) || 'Mặc định',
            duration: 1,
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
        <div className="fav-breadcrumb">
          <Link to="/">TRANG CHỦ</Link> <span>&gt;</span> DANH SÁCH YÊU THÍCH
        </div>

        <div className="fav-header-main-row">
          <div>
            <h1 className="fav-title">Sản Phẩm Yêu Thích</h1>
            <p className="fav-subtitle">
              Bạn có <strong>{products.length} sản phẩm</strong> đã lưu trong bộ sưu tập yêu thích
            </p>
          </div>

          {products.length > 0 && (
            <div className="fav-header-actions">
              <button
                className="btn-fav-move-all"
                onClick={handleMoveAllToCart}
              >
                <i className="fa-solid fa-cart-shopping"></i> CHUYỂN TẤT CẢ VÀO GIỎ
              </button>
              <button
                className="btn-fav-clear-all"
                onClick={handleClearAll}
              >
                <i className="fa-regular fa-trash-can"></i> XÓA TẤT CẢ
              </button>
            </div>
          )}
        </div>

        {/* Filter Tabs Bar */}
        <div className="fav-filter-toolbar">
          <div className="fav-tabs-group">
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

          <div className="fav-escrow-badge">
            <i className="fa-solid fa-shield-halved"></i> BẢO CHỨNG 100% KIỂM ĐỊNH CHÍNH HÃNG
          </div>
        </div>
      </div>

      {/* Favorites Content */}
      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '90px 0', color: '#687261' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: '#5b6e4e', marginBottom: '14px' }}></i>
            <p style={{ fontSize: '14px' }}>Đang tải danh sách trang phục yêu thích của bạn...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="fav-empty-state">
            <div className="fav-empty-icon">
              <i className="fa-regular fa-heart"></i>
            </div>
            <h3 className="fav-empty-title">Danh sách yêu thích đang trống</h3>
            <p className="fav-empty-desc">
              Hãy nhấn vào biểu tượng trái tim ở bất kỳ trang phục nào trong bộ sưu tập để lưu vào đây và theo dõi tiện lợi.
            </p>
            <Link to="/catalog" className="fav-btn-explore">
              <i className="fa-solid fa-shirt"></i> Khám phá bộ sưu tập ngay
            </Link>
          </div>
        ) : (
          <div className="fav-grid-container">
            {filteredProducts.map((item) => {
              const isRental =
                item.tag === 'rental' ||
                (item.rentalPricePer3Days && item.rentalPricePer3Days > 0) ||
                (item.rentalPricePerDay && item.rentalPricePerDay > 0);

              const price = isRental
                ? item.rentalPricePerDay || (item.rentalPricePer3Days ? Math.round(item.rentalPricePer3Days / 3) : 0)
                : item.salePrice || 0;

              const deposit = item.deposit || Math.round(price * 2.5);
              const imgUrl = (item.images && item.images[0]?.imageUrl) || item.image || item.imageUrl || '';
              const targetId = item._id || item.productCode;

              return (
                <div key={targetId} className="fav-card">
                  <div className="fav-card-image-box">
                    {imgUrl ? (
                      <img src={imgUrl} alt={item.name} loading="lazy" />
                    ) : (
                      <span style={{ fontSize: 36, color: '#9da396' }}>👗</span>
                    )}

                    <span className="fav-card-tag-badge">
                      {isRental ? 'THUÊ ĐỒ' : 'MUA BÁN'} {item.aiTryOn && ' '}
                    </span>

                    <button
                      className="fav-card-heart-btn"
                      onClick={() => handleRemoveFavorite(targetId)}
                      title="Xóa khỏi yêu thích"
                    >
                      <i className="fa-solid fa-heart"></i>
                    </button>
                  </div>

                  <div className="fav-card-content">
                    <div className="fav-card-shop">
                      {item.shopId?.name || item.brand || 'VESTORA ATELIER'}
                    </div>

                    <Link to={`/product/${targetId}`} className="fav-card-title">
                      {item.name}
                    </Link>

                    <div className="fav-card-price-row">
                      <span className="fav-card-price-main">
                        {formatVND(price)}{' '}
                        {isRental && <small>/ ngày</small>}
                      </span>

                      {isRental && deposit > 0 && (
                        <span className="fav-card-deposit">Cọc: {formatVND(deposit)}</span>
                      )}
                    </div>

                    <div className="fav-card-actions">
                      <Link
                        to={`/product/${targetId}`}
                        className="fav-btn-view"
                      >
                        Xem chi tiết
                      </Link>

                      {item.aiTryOn && (
                        <button
                          className="fav-btn-tryon"
                          onClick={() => navigate('/try-on/photo')}
                          title="Thử đồ AI trực tuyến"
                        >
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
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
      <div className="fav-prive-banner">
        <div className="fav-prive-card">
          <div>
            <div className="fav-prive-eyebrow">
              <i className="fa-solid fa-crown"></i> ĐẶC QUYỀN HỘI VIÊN VESTORA
            </div>
            <h2 className="fav-prive-title">
              Đồng Bộ Tủ Đồ Ảo Với Chuyên Gia Phong Cách
            </h2>
            <p className="fav-prive-desc">
              Các sản phẩm lưu trong Danh Sách Yêu Thích sẽ được đồng bộ trực tiếp khi bạn đặt lịch thử đồ riêng tư hoặc tham vấn cùng trợ lý AI Stylist.
            </p>
          </div>

          <button className="btn-prive-tryon" onClick={() => navigate('/try-on/photo')}>
            <i className="fa-solid fa-wand-magic-sparkles"></i> THỬ ĐỒ AI NGAY
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
