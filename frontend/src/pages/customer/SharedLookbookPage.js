/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-003
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-004
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-005
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-002
 *
 * SharedLookbookPage — Trang xem Lookbook công khai theo mã chia sẻ (shareCode)
 * - Tiếp cận công khai (không bắt buộc đăng nhập)
 * - Ẩn thông tin nhạy cảm của chủ sở hữu (chỉ hiển thị Tên hiển thị)
 * - Sao chép 1-click vào tủ đồ cá nhân (Clone)
 * - Chuyển toàn bộ vào giỏ hàng thuê/mua
 * - Chuẩn Haute Couture Tokens & Zero-Emoji
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Sparkles, ShoppingBag, Check, ArrowLeft, Lock, BookmarkPlus } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import LookbookGrid from '../../components/customer/wardrobe/LookbookGrid';
import { ConfirmActionModal } from '../../components/customer/wardrobe/ConfirmActionModal';
import * as wishlistService from '../../services/customer/wishlistService';
import { useWishlistStore } from '../../stores/useWishlistStore';
import { useCartStore } from '../../stores/useCartStore';
import '../../components/customer/wardrobe/WardrobeModals.css';
import '../../styles/WardrobePage.css';

export default function SharedLookbookPage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const cartStore = useCartStore();
  const addCollectionToCart = useWishlistStore((state) => state.addCollectionToCart);

  const [loading, setLoading] = useState(true);
  const [lookbookData, setLookbookData] = useState(null);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isCloning, setIsCloning] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const fetchLookbook = async () => {
      if (!shareCode) return;
      setLoading(true);
      setError(null);
      try {
        const data = await wishlistService.getSharedLookbook(shareCode);
        setLookbookData(data);
      } catch (err) {
        setError(err.message || 'Không thể tìm thấy Lookbook này hoặc bộ sưu tập đã được đặt về riêng tư.');
      } finally {
        setLoading(false);
      }
    };

    fetchLookbook();
  }, [shareCode]);

  const handleClone = async () => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoginPromptOpen(true);
      return;
    }

    setIsCloning(true);
    try {
      const cloned = await wishlistService.cloneSharedLookbook(shareCode);
      showToast(`Đã sao chép bộ sưu tập "${cloned.name}" vào tủ đồ của bạn!`);
      setTimeout(() => {
        navigate('/wardrobe');
      }, 1500);
    } catch (err) {
      showToast(err.message || 'Không thể sao chép bộ sưu tập.');
    } finally {
      setIsCloning(false);
    }
  };

  const handleAddToCartAll = () => {
    if (!lookbookData?.items?.length) return;
    const res = (addCollectionToCart && addCollectionToCart(lookbookData.items, cartStore)) || {};
    const { addedCount = 0, skippedCount = 0 } = res;
    if (addedCount > 0) {
      showToast(`Đã thêm ${addedCount} sản phẩm vào giỏ hàng`);
      cartStore.openCart();
    } else if (skippedCount > 0) {
      showToast('Các sản phẩm hiện đã hết hàng hoặc tạm ngưng kinh doanh');
    }
  };

  const handleAddSingleToCart = (item) => {
    const res = (addCollectionToCart && addCollectionToCart([item], cartStore)) || {};
    const { addedCount = 0 } = res;
    if (addedCount > 0) {
      showToast(`Đã thêm món vào giỏ hàng`);
      cartStore.openCart();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--vst-bg-light)' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1240px', width: '100%', margin: '0 auto', padding: '36px 20px 80px 20px' }}>
        {/* Nút quay lại */}
        <div style={{ marginBottom: '20px' }}>
          <Link
            to="/catalog"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13.5px',
              color: 'var(--vst-text-muted)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} />
            <span>Khám phá bộ sưu tập Vestora</span>
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--vst-font-serif)', fontSize: '22px', color: 'var(--vst-gold-dark)' }}>
              Đang tải Lookbook...
            </div>
            <p style={{ fontSize: '13px', color: 'var(--vst-text-muted)', marginTop: '8px' }}>
              Vui lòng chờ trong giây lát
            </p>
          </div>
        ) : error ? (
          <div
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              background: '#FFFFFF',
              border: '1px solid var(--vst-border)',
              borderRadius: '16px',
              maxWidth: '600px',
              margin: '40px auto',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--vst-danger-light)',
                color: 'var(--vst-danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Lock size={26} />
            </div>
            <h2 style={{ fontFamily: 'var(--vst-font-serif)', fontSize: '24px', color: 'var(--vst-black)', margin: '0 0 8px 0' }}>
              Lookbook Không Khả Dụng
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--vst-text-muted)', margin: '0 0 24px 0', lineHeight: 1.6 }}>
              {error}
            </p>
            <Link to="/catalog" className="vst-btn vst-btn--primary">
              Khám phá Catalog thời trang
            </Link>
          </div>
        ) : (
          <div>
            {/* Header Lookbook công khai */}
            <div
              style={{
                background: 'linear-gradient(135deg, #FFFDF9 0%, #F9F6F0 100%)',
                border: '1px solid var(--vst-border)',
                borderRadius: '16px',
                padding: '36px 40px',
                marginBottom: '32px',
                boxShadow: '0 8px 24px rgba(197, 168, 128, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '24px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: 'var(--vst-gold-dark)',
                    marginBottom: '8px',
                  }}
                >
                  <Sparkles size={14} />
                  <span>Vestora Lookbook Cá Nhân</span>
                </div>
                <h1
                  style={{
                    fontFamily: 'var(--vst-font-serif)',
                    fontSize: '32px',
                    fontWeight: 600,
                    color: 'var(--vst-black)',
                    margin: '0 0 8px 0',
                  }}
                >
                  {lookbookData?.collection?.name}
                </h1>
                <div style={{ fontSize: '14px', color: 'var(--vst-text-muted)' }}>
                  Được tuyển chọn bởi{' '}
                  <strong style={{ color: 'var(--vst-black)' }}>{lookbookData?.ownerName || 'Thành viên Vestora'}</strong>
                  {lookbookData?.collection?.eventDate && (
                    <span>
                      {' '}
                      • Sự kiện: {new Date(lookbookData.collection.eventDate).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                  <span> • {lookbookData?.totalCount || 0} món đồ</span>
                </div>
                {lookbookData?.collection?.description && (
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#4A4A4A',
                      marginTop: '12px',
                      fontStyle: 'italic',
                      maxWidth: '680px',
                      lineHeight: 1.6,
                    }}
                  >
                    "{lookbookData.collection.description}"
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="vst-btn vst-btn--outline"
                  onClick={handleClone}
                  disabled={isCloning}
                  title="Lưu bộ sưu tập này vào tủ đồ của bạn"
                >
                  <BookmarkPlus size={16} />
                  <span>{isCloning ? 'Đang lưu...' : 'Lưu vào tủ đồ của tôi'}</span>
                </button>

                <button
                  type="button"
                  className="vst-btn vst-btn--primary"
                  onClick={handleAddToCartAll}
                  disabled={!lookbookData?.items?.length}
                  title="Thêm tất cả trang phục vào giỏ hàng"
                >
                  <ShoppingBag size={16} />
                  <span>Thuê trọn bộ sưu tập</span>
                </button>
              </div>
            </div>

            {/* Grid sản phẩm */}
            <LookbookGrid
              items={lookbookData?.items || []}
              isReadOnly={true}
              onAddToCart={handleAddSingleToCart}
              emptyMessage="Bộ sưu tập này hiện chưa có món đồ nào."
            />
          </div>
        )}
      </main>

      {/* Toast thông báo */}
      {toastMessage && (
        <div className="vst-toast">
          <Check size={18} color="var(--vst-gold)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal nhắc đăng nhập khi sao chép Lookbook */}
      <ConfirmActionModal
        isOpen={loginPromptOpen}
        title="Yêu cầu đăng nhập"
        message="Bạn cần đăng nhập tài khoản Vestora để lưu bộ sưu tập này vào tủ đồ của mình."
        confirmText="Đăng nhập ngay"
        cancelText="Để sau"
        onConfirm={() => navigate('/login')}
        onClose={() => setLoginPromptOpen(false)}
      />

      <Footer />
    </div>
  );
}
