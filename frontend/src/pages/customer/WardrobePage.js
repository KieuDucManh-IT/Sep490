/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-UI-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-UI-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-UI-003
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-004
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-005
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-007
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-010
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-011
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-002
 *
 * WardrobePage — Không Gian Tủ Đồ Số & Bộ Sưu Tập Cá Nhân Hợp Nhất (Vestora)
 * - Tích hợp toàn diện Danh sách Yêu thích và Bộ sưu tập tùy chỉnh vào 1 không gian duy nhất
 * - Chuẩn Haute Couture Tokens, 100% Zero-Alert và Zero-Emoji
 * - Điều hướng sidebar trực quan, quản lý ghi chú stylist, chia sẻ Lookbook
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sparkles,
  ShoppingBag,
  Share2,
  Edit2,
  Calendar,
  Camera,
  Check,
  Layers,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import CollectionSidebar from '../../components/customer/wardrobe/CollectionSidebar';
import LookbookGrid from '../../components/customer/wardrobe/LookbookGrid';
import CreateCollectionModal from '../../components/customer/wardrobe/CreateCollectionModal';
import SaveToCollectionModal from '../../components/customer/wardrobe/SaveToCollectionModal';
import ShareLookbookModal from '../../components/customer/wardrobe/ShareLookbookModal';
import ConfirmActionModal from '../../components/customer/wardrobe/ConfirmActionModal';
import StylingNoteModal from '../../components/customer/wardrobe/StylingNoteModal';
import { useWishlistStore } from '../../stores/useWishlistStore';
import { useCartStore } from '../../stores/useCartStore';
import '../../components/customer/wardrobe/WardrobeModals.css';
import '../../styles/WardrobePage.css';

// Dữ liệu mẫu AI Stylist & Ướm thử (Bảo tồn tính năng AI Try-On)
const AI_SUGGESTED_ITEMS = [
  {
    _id: 'ai_1',
    productId: {
      _id: 'prod_ai_1',
      name: 'Đầm dạ hội ánh tím xẻ tà Haute Couture',
      productCode: 'VESTORA-DR-089',
      primaryImageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
      tag: 'rental',
      rentalPricePerDay: 350000,
      deposit: 1000000,
      status: 'active',
    },
    notes: 'AI chấm điểm 98% tôn đường cong và nước da cho tiệc tối sang trọng',
    targetUsageDate: '2026-11-15',
  },
  {
    _id: 'ai_2',
    productId: {
      _id: 'prod_ai_2',
      name: 'Blazer cashmere thanh lịch màu be sữa',
      productCode: 'VESTORA-BZ-012',
      primaryImageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80',
      tag: 'sale',
      salePrice: 1850000,
      status: 'active',
    },
    notes: 'Dễ dàng mix cùng quần âu ống đứng hoặc chân váy midi',
  },
  {
    _id: 'ai_3',
    productId: {
      _id: 'prod_ai_3',
      name: 'Áo dài cách tân hồng phấn thêu hoa thủ công',
      productCode: 'VESTORA-AD-007',
      primaryImageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80',
      tag: 'rental',
      rentalPricePerDay: 280000,
      deposit: 800000,
      status: 'active',
    },
    notes: 'Đã ướm thử qua AI Try-On với điểm tương thích 97%',
    targetUsageDate: '2026-12-01',
  },
];

export default function WardrobePage() {
  const location = useLocation();
  const cartStore = useCartStore();

  const queryParams = new URLSearchParams(location.search);
  const initialFilter = queryParams.get('filter');

  // Zustand Store
  const {
    itemCount,
    defaultWishlist,
    collections,
    activeCollection,
    fetchWishlist,
    fetchCollections,
    selectCollection,
    deleteCollection,
    removeItemFromCollection,
    addCollectionToCart,
  } = useWishlistStore();

  // Local State
  const [activeTab, setActiveTab] = useState(initialFilter === 'ai-suggested' || initialFilter === 'tryon-history' ? 'ai' : 'collections');
  const [selectedColId, setSelectedColId] = useState('default'); // 'default' hoặc collectionId
  const [toastMessage, setToastMessage] = useState(null);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [productToSave, setProductToSave] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [collectionToShare, setCollectionToShare] = useState(null);
  const [stylingModalOpen, setStylingModalOpen] = useState(false);
  const [itemToEditNotes, setItemToEditNotes] = useState(null);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    isDestructive: false,
    onConfirm: () => {},
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Khởi tạo tải dữ liệu
  useEffect(() => {
    fetchWishlist();
    fetchCollections();
  }, [fetchWishlist, fetchCollections]);

  // Đồng bộ URL query param nếu có
  useEffect(() => {
    if (initialFilter === 'ai-suggested' || initialFilter === 'tryon-history') {
      setActiveTab('ai');
    }
  }, [initialFilter]);

  // Xử lý khi chọn bộ sưu tập từ sidebar
  const handleSelectCollection = async (colId) => {
    setSelectedColId(colId);
    setActiveTab('collections');
    if (colId !== 'default') {
      await selectCollection(colId);
    }
  };

  // Lấy danh sách item đang hiển thị
  const currentItems = useMemo(() => {
    if (activeTab === 'ai') {
      return AI_SUGGESTED_ITEMS;
    }
    if (selectedColId === 'default') {
      return defaultWishlist.items || [];
    }
    return activeCollection?.items || [];
  }, [activeTab, selectedColId, defaultWishlist.items, activeCollection?.items]);

  // Lấy thông tin bộ sưu tập đang hiển thị
  const currentCollectionMeta = useMemo(() => {
    if (selectedColId === 'default') {
      return {
        name: 'Tất cả yêu thích',
        description: 'Tập hợp tất cả các thiết kế thời trang bạn đã lưu bằng nút thả tim trên Vestora.',
        itemCount: itemCount,
        isDefault: true,
      };
    }
    return collections.find((c) => c._id === selectedColId) || activeCollection?.collection || null;
  }, [selectedColId, itemCount, collections, activeCollection]);

  // Thêm toàn bộ bộ sưu tập hiện tại vào giỏ hàng
  const handleAddAllToCart = () => {
    if (!currentItems.length) return;
    const res = addCollectionToCart(currentItems, cartStore) || {};
    const { addedCount = 0, skippedCount = 0 } = res;
    if (addedCount > 0) {
      showToast(`Đã thêm ${addedCount} sản phẩm vào giỏ hàng thành công!`);
      cartStore.openCart();
    } else if (skippedCount > 0) {
      showToast('Các sản phẩm hiện đã hết hàng hoặc tạm ngưng kinh doanh');
    }
  };

  // Thêm 1 món vào giỏ hàng
  const handleAddSingleToCart = (item) => {
    const res = addCollectionToCart([item], cartStore) || {};
    const { addedCount = 0 } = res;
    if (addedCount > 0) {
      showToast(`Đã thêm sản phẩm vào giỏ hàng`);
      cartStore.openCart();
    }
  };

  // Xóa món khỏi bộ sưu tập
  const handleRemoveItem = (item) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa món đồ khỏi bộ sưu tập',
      message: `Bạn có chắc chắn muốn bỏ "${item.productId?.name || 'món đồ này'}" khỏi bộ sưu tập không?`,
      confirmText: 'Xóa khỏi BST',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await removeItemFromCollection(selectedColId, item._id);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          showToast('Đã xóa món đồ khỏi bộ sưu tập');
        } catch (err) {
          showToast(err.message || 'Không thể xóa món đồ');
        }
      },
    });
  };

  // Xóa bộ sưu tập
  const handleDeleteCollection = (col) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa bộ sưu tập',
      message: `Bạn có chắc chắn muốn xóa bộ sưu tập "${col.name}"? Các món đồ bên trong sẽ không bị xóa khỏi danh sách Yêu thích của bạn.`,
      confirmText: 'Xác nhận xóa',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteCollection(col._id);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          setSelectedColId('default');
          showToast(`Đã xóa bộ sưu tập "${col.name}"`);
        } catch (err) {
          showToast(err.message || 'Không thể xóa bộ sưu tập');
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--vst-bg-light)' }}>
      <Navbar />

      <main className="wardrobe-main-container">
        {/* Header Hero Banner */}
        <section className="wardrobe-header-card">
          <div className="header-text-group">
            <div className="wardrobe-tagline">
              <Sparkles size={14} color="#7b4eb2" />
              <span>Vestora Haute Couture Wardrobe</span>
            </div>
            <h1 className="wardrobe-title">Tủ Đồ Kỹ Thuật Số</h1>
            <p className="wardrobe-description">
              Không gian quản lý tủ đồ cá nhân cao cấp. Lưu giữ trang phục yêu thích, tổ chức các bộ sưu tập theo sự kiện (Dạ tiệc, Lễ cưới, Công sở) và chia sẻ Lookbook cùng bạn bè.
            </p>
          </div>

          <div className="header-action-group">
            <Link to="/try-on/photo" className="btn-header-tryon">
              <Camera size={16} />
              <span>Ướm thử trang phục AI</span>
            </Link>
            <Link to="/catalog" className="btn-header-explore">
              <span>Khám phá Catalogue</span>
            </Link>
          </div>
        </section>

        {/* Thanh chuyển đổi Tab chính (Tủ đồ & Bộ sưu tập / Gợi ý AI) */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '1px solid var(--vst-border)',
            paddingBottom: '12px',
          }}
        >
          <button
            type="button"
            className={`vst-btn vst-btn--sm ${activeTab === 'collections' ? 'vst-btn--primary' : 'vst-btn--outline'}`}
            onClick={() => setActiveTab('collections')}
          >
            <Layers size={15} />
            <span>Tủ đồ & Bộ sưu tập cá nhân ({itemCount})</span>
          </button>

          <button
            type="button"
            className={`vst-btn vst-btn--sm ${activeTab === 'ai' ? 'vst-btn--primary' : 'vst-btn--outline'}`}
            onClick={() => setActiveTab('ai')}
          >
            <Sparkles size={15} />
            <span>Gợi ý AI Stylist & Ướm thử ({AI_SUGGESTED_ITEMS.length})</span>
          </button>
        </div>

        {/* Nội dung chính: Sidebar và Lưới sản phẩm */}
        <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Cột trái: Sidebar bộ sưu tập */}
          {activeTab === 'collections' && (
            <div style={{ flex: '0 0 280px', width: '280px' }}>
              <CollectionSidebar
                collections={collections}
                activeId={selectedColId}
                totalWishlistCount={itemCount}
                onSelect={handleSelectCollection}
                onCreate={() => {
                  setEditingCollection(null);
                  setCreateModalOpen(true);
                }}
                onEdit={(col) => {
                  setEditingCollection(col);
                  setCreateModalOpen(true);
                }}
                onDelete={handleDeleteCollection}
                onShare={(col) => {
                  setCollectionToShare(col);
                  setShareModalOpen(true);
                }}
              />
            </div>
          )}

          {/* Cột phải: Chi tiết Bộ sưu tập & Grid sản phẩm */}
          <div style={{ flex: 1, minWidth: '320px' }}>
            {/* Thanh tiêu đề & Công cụ của Bộ sưu tập hiện tại */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--vst-border)',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2
                    style={{
                      fontFamily: 'var(--vst-font-serif)',
                      fontSize: '24px',
                      color: 'var(--vst-black)',
                      margin: 0,
                    }}
                  >
                    {activeTab === 'ai' ? 'Gợi ý AI Stylist & Lịch sử Ướm thử' : currentCollectionMeta?.name}
                  </h2>
                  <span className="vst-collection-badge">
                    {activeTab === 'ai' ? AI_SUGGESTED_ITEMS.length : currentItems.length} món
                  </span>
                </div>

                {currentCollectionMeta?.eventDate && activeTab === 'collections' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12.5px',
                      color: 'var(--vst-gold-dark)',
                      marginTop: '4px',
                    }}
                  >
                    <Calendar size={13} />
                    <span>Dự kiến: {new Date(currentCollectionMeta.eventDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                )}

                {currentCollectionMeta?.description && (
                  <p style={{ fontSize: '13.5px', color: 'var(--vst-text-muted)', margin: '6px 0 0 0' }}>
                    {currentCollectionMeta.description}
                  </p>
                )}
              </div>

              {/* Action buttons của BST */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {activeTab === 'collections' && selectedColId !== 'default' && (
                  <>
                    <button
                      type="button"
                      className="vst-btn vst-btn--outline vst-btn--sm"
                      onClick={() => {
                        setCollectionToShare(currentCollectionMeta);
                        setShareModalOpen(true);
                      }}
                      title="Chia sẻ Lookbook công khai"
                    >
                      <Share2 size={14} />
                      <span>Chia sẻ Lookbook</span>
                    </button>

                    <button
                      type="button"
                      className="vst-btn vst-btn--outline vst-btn--sm"
                      onClick={() => {
                        setEditingCollection(currentCollectionMeta);
                        setCreateModalOpen(true);
                      }}
                      title="Chỉnh sửa thông tin bộ sưu tập"
                    >
                      <Edit2 size={14} />
                      <span>Sửa</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="vst-btn vst-btn--primary vst-btn--sm"
                  onClick={handleAddAllToCart}
                  disabled={!currentItems.length}
                  title="Thêm toàn bộ món đồ khả dụng vào giỏ hàng"
                >
                  <ShoppingBag size={14} />
                  <span>Thêm tất cả vào giỏ</span>
                </button>
              </div>
            </div>

            {/* Grid danh sách trang phục */}
            <LookbookGrid
              items={currentItems}
              isDefault={selectedColId === 'default'}
              onAddToCart={handleAddSingleToCart}
              onRemoveItem={handleRemoveItem}
              onEditNotes={(item) => {
                setItemToEditNotes(item);
                setStylingModalOpen(true);
              }}
              onSaveToCollection={(prod) => {
                setProductToSave(prod);
                setSaveModalOpen(true);
              }}
              emptyMessage={
                selectedColId === 'default'
                  ? 'Bạn chưa thả tim trang phục nào.'
                  : 'Bộ sưu tập này chưa có trang phục nào.'
              }
            />
          </div>
        </div>
      </main>

      {/* ========================================================
          CÁC CUSTOM MODALS CHUẨN HAUTE COUTURE (ZERO-NATIVE DIALOGS)
          ======================================================== */}

      {/* 1. Modal Tạo / Sửa Bộ sưu tập */}
      <CreateCollectionModal
        isOpen={createModalOpen}
        collection={editingCollection}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingCollection(null);
        }}
        onSuccess={(savedCol) => {
          showToast(`Đã lưu bộ sưu tập "${savedCol.name}"`);
          setSelectedColId(savedCol._id);
        }}
      />

      {/* 2. Modal Lưu món vào Bộ sưu tập khác */}
      <SaveToCollectionModal
        isOpen={saveModalOpen}
        product={productToSave}
        onClose={() => {
          setSaveModalOpen(false);
          setProductToSave(null);
        }}
        onSuccess={(added) => {
          showToast('Đã thêm sản phẩm vào bộ sưu tập');
        }}
        onRequestCreateCollection={() => {
          setEditingCollection(null);
          setCreateModalOpen(true);
        }}
      />

      {/* 3. Modal Chia sẻ Lookbook */}
      <ShareLookbookModal
        isOpen={shareModalOpen}
        collection={collectionToShare}
        onClose={() => {
          setShareModalOpen(false);
          setCollectionToShare(null);
        }}
        onShareChanged={(res) => {
          showToast(res.isPrivate ? 'Đã chuyển về chế độ riêng tư' : 'Đã bật chia sẻ Lookbook công khai');
        }}
      />

      {/* 4. Modal Chỉnh sửa Ghi chú Phối đồ */}
      <StylingNoteModal
        isOpen={stylingModalOpen}
        collectionId={selectedColId}
        item={itemToEditNotes}
        onClose={() => {
          setStylingModalOpen(false);
          setItemToEditNotes(null);
        }}
        onSaved={() => {
          showToast('Đã cập nhật ghi chú phong cách');
        }}
      />

      {/* 5. Modal Xác nhận Xóa / Hành động (Zero-Native Dialogs) */}
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Custom Toast thông báo */}
      {toastMessage && (
        <div className="vst-toast">
          <Check size={18} color="var(--vst-gold)" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Footer />
    </div>
  );
}
