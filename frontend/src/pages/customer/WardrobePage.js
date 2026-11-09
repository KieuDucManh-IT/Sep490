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
 * - Lưu giữ lịch sử ảnh thật người dùng đã ướm thử qua AI Virtual Try-On
 * - Chuẩn Haute Couture Tokens, 100% Zero-Alert và Zero-Emoji
 * - Điều hướng sidebar trực quan, quản lý ghi chú stylist, chia sẻ Lookbook
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  ShoppingBag,
  Share2,
  Edit2,
  Calendar,
  Camera,
  Check,
  Layers,
  Trash2,
  ArrowRight,
  RotateCcw,
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
import wardrobeApi from '../../services/wardrobeApi';
import '../../components/customer/wardrobe/WardrobeModals.css';
import '../../styles/WardrobePage.css';

// Dữ liệu mẫu AI Stylist & Ướm thử (Hiển thị khi tủ đồ AI cá nhân chưa có dữ liệu)
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
  const navigate = useNavigate();
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
  const [activeTab, setActiveTab] = useState(
    initialFilter === 'ai-suggested' || initialFilter === 'tryon-history' ? 'ai' : 'collections'
  );
  const [selectedColId, setSelectedColId] = useState('default'); // 'default' hoặc collectionId
  const [aiFilter, setAiFilter] = useState(
    initialFilter === 'tryon-history' ? 'tryon-history' : initialFilter === 'ai-suggested' ? 'ai-suggested' : 'all'
  );
  const [wardrobeList, setWardrobeList] = useState([]);
  const [loadingWardrobe, setLoadingWardrobe] = useState(false);
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

  // Khởi tạo tải dữ liệu BST từ Store
  useEffect(() => {
    fetchWishlist();
    fetchCollections();
  }, [fetchWishlist, fetchCollections]);

  // Tải danh sách tủ đồ thật từ backend (lịch sử ướm thử AI)
  const loadWardrobe = async () => {
    try {
      setLoadingWardrobe(true);
      const items = await wardrobeApi.getWardrobe();
      setWardrobeList(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Lỗi tải tủ đồ từ backend:', err);
      setWardrobeList([]);
    } finally {
      setLoadingWardrobe(false);
    }
  };

  useEffect(() => {
    loadWardrobe();
  }, []);

  // Đồng bộ URL query param nếu có
  useEffect(() => {
    if (initialFilter === 'ai-suggested' || initialFilter === 'tryon-history') {
      setActiveTab('ai');
      setAiFilter(initialFilter);
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

  // Lấy danh sách item đang hiển thị cho tab Bộ sưu tập
  const currentCollectionItems = useMemo(() => {
    if (selectedColId === 'default') {
      return defaultWishlist.items || [];
    }
    return activeCollection?.items || [];
  }, [selectedColId, defaultWishlist.items, activeCollection?.items]);

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

  // Lọc danh sách đồ thử AI theo filter
  const filteredWardrobeItems = useMemo(() => {
    return wardrobeList.filter((item) => {
      const itemTags = Array.isArray(item.tags) ? item.tags : [];
      if (aiFilter === 'all') return true;
      if (aiFilter === 'tryon-history') return itemTags.includes('tryon-history') || Boolean(item.tryOnImageUrl);
      if (aiFilter === 'ai-suggested') return itemTags.includes('ai-suggested');
      return true;
    });
  }, [wardrobeList, aiFilter]);

  // Xóa trang phục thử AI khỏi tủ đồ
  const handleRemoveWardrobeItem = (e, id, title) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Bỏ lưu khỏi tủ đồ',
      message: `Bạn có chắc chắn muốn bỏ "${title || 'trang phục này'}" khỏi tủ đồ cá nhân không?`,
      confirmText: 'Xác nhận xóa',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await wardrobeApi.removeFromWardrobe(id);
          setWardrobeList((prev) => prev.filter((item) => (item._id || item.id) !== id));
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          showToast(`Đã bỏ "${title || 'trang phục'}" khỏi tủ đồ cá nhân`);
        } catch (err) {
          showToast('Không thể bỏ trang phục khỏi tủ đồ, vui lòng thử lại.');
        }
      },
    });
  };

  // Thêm toàn bộ bộ sưu tập hiện tại vào giỏ hàng
  const handleAddAllToCart = () => {
    if (!currentCollectionItems.length) return;
    const res = addCollectionToCart(currentCollectionItems, cartStore) || {};
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
      showToast('Đã thêm sản phẩm vào giỏ hàng');
      cartStore.openCart();
    }
  };

  // Xóa món khỏi bộ sưu tập wishlist
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

  const formatPrice = (val) => new Intl.NumberFormat('vi-VN').format(val || 0) + ' ₫';

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
              Không gian quản lý tủ đồ cá nhân cao cấp. Lưu giữ trang phục yêu thích, tổ chức các bộ sưu tập theo sự kiện (Dạ tiệc, Lễ cưới, Công sở), xem lại ảnh đã ướm thử AI và chia sẻ Lookbook cùng bạn bè.
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
            <span>
              Gợi ý AI Stylist & Ướm thử ({wardrobeList.length > 0 ? wardrobeList.length : AI_SUGGESTED_ITEMS.length})
            </span>
          </button>
        </div>

        {/* ========================================================
            TAB 1: TỦ ĐỒ & BỘ SƯU TẬP CÁ NHÂN (WISHLIST + COLLECTIONS)
            ======================================================== */}
        {activeTab === 'collections' && (
          <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Cột trái: Sidebar bộ sưu tập */}
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
                      {currentCollectionMeta?.name}
                    </h2>
                    <span className="vst-collection-badge">
                      {currentCollectionItems.length} món
                    </span>
                  </div>

                  {currentCollectionMeta?.eventDate && (
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
                  {selectedColId !== 'default' && (
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
                    disabled={!currentCollectionItems.length}
                    title="Thêm toàn bộ món đồ khả dụng vào giỏ hàng"
                  >
                    <ShoppingBag size={14} />
                    <span>Thêm tất cả vào giỏ</span>
                  </button>
                </div>
              </div>

              {/* Grid danh sách trang phục */}
              <LookbookGrid
                items={currentCollectionItems}
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
        )}

        {/* ========================================================
            TAB 2: GỢI Ý AI STYLIST & LỊCH SỬ ƯỚM THỬ AI
            ======================================================== */}
        {activeTab === 'ai' && (
          <div>
            {/* Quick Stats Bar */}
            <div className="wardrobe-stats-bar">
              <div className="stat-box">
                <span className="stat-number">{wardrobeList.length}</span>
                <span className="stat-label">Trang phục đã lưu</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-box">
                <span className="stat-number">
                  {wardrobeList.filter((i) => i.tryOnImageUrl || (Array.isArray(i.tags) && i.tags.includes('tryon-history'))).length}
                </span>
                <span className="stat-label">Ảnh đã ghép AI</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-box">
                <span className="stat-number">
                  {wardrobeList.filter((i) => Array.isArray(i.tags) && i.tags.includes('ai-suggested')).length}
                </span>
                <span className="stat-label">AI Stylist gợi ý</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-box">
                <span className="stat-number">98%</span>
                <span className="stat-label">Độ tương thích chuẩn</span>
              </div>
            </div>

            {/* Filter Navigation Tabs */}
            <div className="wardrobe-filter-tabs">
              <button
                type="button"
                className={`w-tab-btn ${aiFilter === 'all' ? 'active' : ''}`}
                onClick={() => setAiFilter('all')}
              >
                <span>Tất cả ({wardrobeList.length})</span>
              </button>
              <button
                type="button"
                className={`w-tab-btn ${aiFilter === 'tryon-history' ? 'active' : ''}`}
                onClick={() => setAiFilter('tryon-history')}
              >
                <Camera size={14} />
                <span>
                  Đã thử bằng AI ({wardrobeList.filter((i) => i.tryOnImageUrl || (Array.isArray(i.tags) && i.tags.includes('tryon-history'))).length})
                </span>
              </button>
              <button
                type="button"
                className={`w-tab-btn ${aiFilter === 'ai-suggested' ? 'active' : ''}`}
                onClick={() => setAiFilter('ai-suggested')}
              >
                <Sparkles size={14} />
                <span>
                  Gợi ý AI Stylist ({wardrobeList.filter((i) => Array.isArray(i.tags) && i.tags.includes('ai-suggested')).length})
                </span>
              </button>
            </div>

            {/* Nội dung danh sách */}
            {loadingWardrobe ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid rgba(0,0,0,0.1)',
                    borderTopColor: 'var(--color-gold, #D4AF37)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    margin: '0 auto 16px auto',
                  }}
                />
                <p>Đang tải tủ đồ cá nhân từ hệ thống...</p>
              </div>
            ) : filteredWardrobeItems.length === 0 ? (
              <div className="wardrobe-empty-state">
                <div className="empty-icon-wrap">
                  <Camera size={32} color="var(--vst-gold-dark)" />
                </div>
                <h3>Tủ đồ AI của bạn chưa có trang phục trong mục này</h3>
                <p>Hãy trải nghiệm tính năng thử đồ AI hoặc khám phá bộ sưu tập để lưu các bộ outfit ưng ý vào tủ đồ.</p>
                <div className="empty-btn-group">
                  <button
                    type="button"
                    className="btn-empty-primary"
                    onClick={() => navigate('/try-on/photo')}
                  >
                    <Sparkles size={15} />
                    <span>Thử đồ với AI ngay</span>
                  </button>
                  <button
                    type="button"
                    className="btn-empty-outline"
                    onClick={() => navigate('/catalog')}
                  >
                    <span>Xem tất cả trang phục</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="wardrobe-cards-grid">
                {filteredWardrobeItems.map((item) => {
                  const itemId = item._id || item.id;
                  const productTargetId = (typeof item.productId === 'object' && item.productId?._id)
                    ? item.productId._id
                    : (item.productId || item.productCode || itemId);
                  const displayImage = item.tryOnImageUrl || item.image || (item.productId && item.productId.primaryImageUrl);

                  return (
                    <div key={itemId} className="wardrobe-item-card">
                      {/* Media Container */}
                      <div className="item-media-container">
                        <img
                          src={displayImage}
                          alt={item.title || 'Trang phục thử'}
                          className="item-thumbnail"
                          onClick={() => navigate(`/product/${productTargetId}`)}
                          style={{ cursor: 'pointer' }}
                        />

                        {/* AI Try-on Badge nếu có ảnh thử đồ */}
                        {item.tryOnImageUrl && (
                          <span className="item-tryon-badge">
                            <Sparkles size={12} /> Ảnh thử AI
                          </span>
                        )}

                        {/* AI Match Badge */}
                        <div className="item-ai-match-badge">
                          <Sparkles size={12} /> {item.matchScore || 98}% Hợp dáng
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          className="btn-remove-item"
                          title="Bỏ lưu khỏi tủ đồ"
                          onClick={(e) => handleRemoveWardrobeItem(e, itemId, item.title)}
                        >
                          <Trash2 size={14} />
                        </button>

                        {/* Type Badge */}
                        <span className={`item-type-badge badge-${item.typeBadge || 'rental'}`}>
                          {item.typeBadge === 'sale' ? 'Mua bán' : 'Thuê đồ'}
                        </span>
                      </div>

                      {/* Details Container */}
                      <div className="item-details-container">
                        <div className="item-category-line">
                          <span className="item-category-tag">{item.category || 'Haute Couture'}</span>
                          <span className="item-saved-date">
                            {item.savedDate ? `Lưu ngày: ${item.savedDate}` : ''}
                          </span>
                        </div>

                        <h3 className="item-title">
                          <Link to={`/product/${productTargetId}`}>{item.title}</Link>
                        </h3>

                        {/* AI Stylist Note */}
                        <div className="item-ai-note-box">
                          <p>{item.aiNote || 'Trang phục vừa vặn và tôn vóc dáng của bạn.'}</p>
                        </div>

                        {/* Pricing and Action Buttons */}
                        <div className="item-footer-row">
                          <div className="item-price-col">
                            <span className="price-number">{formatPrice(item.price)}</span>
                            {item.priceUnit && <span className="price-sub">{item.priceUnit}</span>}
                          </div>

                          <div className="item-actions-col">
                            <button
                              type="button"
                              className="btn-tryon-again"
                              title="Ướm thử lại bằng AI"
                              onClick={() => navigate(`/try-on/photo?product=${productTargetId}`)}
                            >
                              <RotateCcw size={13} />
                              <span>Thử lại</span>
                            </button>
                            <button
                              type="button"
                              className="btn-rent-now"
                              onClick={() => navigate(`/product/${productTargetId}`)}
                            >
                              <span>Chi tiết</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
        onSuccess={() => {
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
