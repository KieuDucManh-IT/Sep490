import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  ShoppingCart,
  Trash2,
  ShieldCheck,
  Loader2,
  Sparkles,
  Crown,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import productService from '../../services/productService';
import { useCartStore } from '../../stores/useCartStore';
import { ORDER_TYPES } from '../../services/cart/cartTypes';
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
  const [showClearModal, setShowClearModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
            const matched = res.data.filter(
              (p) =>
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
      showToast('Đã bỏ trang phục khỏi danh sách yêu thích');
    } catch {}
  };

  // Clear all favorites
  const handleConfirmClearAll = () => {
    setFavoriteIds([]);
    setShowClearModal(false);
    try {
      localStorage.removeItem('vestora_favorites');
      window.dispatchEvent(new Event('favoritesUpdated'));
      showToast('Đã xóa toàn bộ danh sách yêu thích');
    } catch {}
  };

  // Move all to cart
  const handleMoveAllToCart = () => {
    if (products.length === 0) return;
    try {
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const due = new Date();
      due.setDate(due.getDate() + 3);
      const dueDate = due.toISOString().split('T')[0];

      products.forEach((p) => {
        const isRental =
          p.tag === 'rental' ||
          (p.rentalPricePer3Days && p.rentalPricePer3Days > 0) ||
          (p.rentalPricePerDay && p.rentalPricePerDay > 0);

        const price = isRental
          ? p.rentalPricePerDay || (p.rentalPricePer3Days ? Math.round(p.rentalPricePer3Days / 3) : 0)
          : p.salePrice || 0;

        const variantId = `${p._id || p.productCode || 'prod'}-M-default`;
        const sku = p.productCode || p.sku || `SKU-${p._id || 'VAR'}`;

        useCartStore.getState().addItem({
          productId: String(p._id || p.productCode),
          variantId,
          sku,
          name: p.name,
          size: (p.sizes && p.sizes[0]) || 'M',
          color: (p.colors && p.colors[0]) || 'Mặc định',
          thumbnailImage: (p.images && p.images[0]?.imageUrl) || p.image || p.imageUrl || '',
          orderType: isRental ? ORDER_TYPES.RENTAL : ORDER_TYPES.SALE,
          quantity: 1,
          rentalPricePerDay: isRental ? price : 0,
          depositAmount: isRental ? p.deposit || Math.round(price * 2.5) : 0,
          startDate: isRental ? startDate : '',
          dueDate: isRental ? dueDate : '',
          rentalDays: isRental ? 3 : 0,
          salePrice: !isRental ? price : 0,
        });
      });

      useCartStore.getState().openCart();
      showToast(`Đã thêm ${products.length} sản phẩm vào giỏ hàng`);
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

      {/* Floating Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            zIndex: 99999,
            background: '#171717',
            color: '#F8F7F4',
            border: '1px solid #C5A880',
            borderRadius: 10,
            padding: '12px 20px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          <CheckCircle2 size={16} color="#C5A880" />
          <span>{toastMessage}</span>
        </div>
      )}

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
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <ShoppingCart size={15} /> CHUYỂN TẤT CẢ VÀO GIỎ
              </button>
              <button
                className="btn-fav-clear-all"
                onClick={() => setShowClearModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Trash2 size={15} /> XÓA TẤT CẢ
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

          <div className="fav-guarantee-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} color="#C5A880" /> CAM KẾT CHÍNH HÃNG 100% KIỂM ĐỊNH
          </div>
        </div>
      </div>

      {/* Favorites Content */}
      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '0 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '90px 0', color: '#687261' }}>
            <Loader2 size={32} color="#C5A880" className="spin" style={{ margin: '0 auto 14px' }} />
            <p style={{ fontSize: '14px' }}>Đang tải danh sách trang phục yêu thích của bạn...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="fav-empty-state">
            <div className="fav-empty-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={38} color="#C5A880" />
            </div>
            <h3 className="fav-empty-title">Danh sách yêu thích đang trống</h3>
            <p className="fav-empty-desc">
              Hãy nhấn vào biểu tượng trái tim ở bất kỳ trang phục nào trong bộ sưu tập để lưu vào đây và theo dõi tiện lợi.
            </p>
            <Link to="/catalog" className="fav-btn-explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} /> Khám phá bộ sưu tập ngay
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F8F7F4' }}>
                        <Sparkles size={36} color="#C5A880" />
                      </div>
                    )}

                    <span className="fav-card-tag-badge">
                      {isRental ? 'THUÊ ĐỒ' : 'MUA BÁN'}
                    </span>

                    <button
                      className="fav-card-heart-btn"
                      onClick={() => handleRemoveFavorite(targetId)}
                      title="Xóa khỏi yêu thích"
                      aria-label="Xóa khỏi yêu thích"
                    >
                      <Heart size={16} fill="#C5A880" color="#C5A880" />
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
                          aria-label="Thử đồ AI trực tuyến"
                        >
                          <Sparkles size={14} color="#C5A880" />
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
            <div className="fav-prive-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Crown size={15} color="#C5A880" /> ĐẶC QUYỀN HỘI VIÊN VESTORA
            </div>
            <h2 className="fav-prive-title">
              Đồng Bộ Tủ Đồ Ảo Với Chuyên Gia Phong Cách
            </h2>
            <p className="fav-prive-desc">
              Các sản phẩm lưu trong Danh Sách Yêu Thích sẽ được đồng bộ trực tiếp khi bạn đặt lịch thử đồ riêng tư hoặc tham vấn cùng trợ lý AI Stylist.
            </p>
          </div>

          <button
            className="btn-prive-tryon"
            onClick={() => navigate('/try-on/photo')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Sparkles size={16} /> THỬ ĐỒ AI NGAY
          </button>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showClearModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(23, 23, 23, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowClearModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 420,
              width: '100%',
              padding: '28px 24px',
              border: '1px solid #E5E0D8',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Trash2 size={24} color="#DC2626" />
            </div>
            <h3
              style={{
                fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                fontSize: 20,
                color: '#171717',
                marginBottom: 8,
              }}
            >
              Xóa Danh Sách Yêu Thích?
            </h3>
            <p style={{ fontSize: 13.5, color: '#71717A', lineHeight: 1.5, marginBottom: 24 }}>
              Toàn bộ các trang phục đã lưu sẽ bị gỡ khỏi danh sách của bạn. Quý khách có thể thêm lại bất cứ lúc nào trong danh mục.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 8,
                  border: '1px solid #E5E0D8',
                  background: '#F8F7F4',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#171717',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Xóa tất cả
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
