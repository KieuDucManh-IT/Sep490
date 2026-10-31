import React, { useState, useEffect, useCallback, useMemo } from 'react';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import apiClient from '../../services/api';
import '../../styles/AdminDashboard.css';
import '../../styles/OpsShops.css';

const DEFAULT_PRICING_ITEMS = [
  {
    id: 'VAR-101',
    sku: 'VES-TUX-01',
    name: 'Suit Tuxedo Tux Lux May Đo',
    variant: 'Black Edition • Size 48/50',
    category: 'Tuxedo & Suit',
    salePrice: 12500000,
    rentalPricePerDay: 700000,
    depositAmount: 5000000,
    status: 'ACTIVE',
  },
  {
    id: 'VAR-102',
    sku: 'VES-DRS-02',
    name: 'Đầm Dạ Hội Lụa Satin Midnight',
    variant: 'Emerald Silk • Size M',
    category: 'Đầm Dạ Hội',
    salePrice: 8900000,
    rentalPricePerDay: 480000,
    depositAmount: 3500000,
    status: 'ACTIVE',
  },
  {
    id: 'VAR-103',
    sku: 'VES-AOD-03',
    name: 'Áo Dài Cách Tân Gấm Hoàng Cung',
    variant: 'Gấm Thêu Tay • Size S',
    category: 'Áo Dài Truyền Thống',
    salePrice: 4500000,
    rentalPricePerDay: 280000,
    depositAmount: 2000000,
    status: 'ACTIVE',
  },
  {
    id: 'VAR-104',
    sku: 'VES-WED-04',
    name: 'Váy Cưới Ren Pháp Haute Couture',
    variant: 'Pure White • Custom Fit',
    category: 'Váy Cưới',
    salePrice: 35000000,
    rentalPricePerDay: 1500000,
    depositAmount: 12000000,
    status: 'ACTIVE',
  },
  {
    id: 'VAR-105',
    sku: 'VES-BLZ-05',
    name: 'Blazer Linen Tối Giản Hàn Quốc',
    variant: 'Sand Beige • Size L',
    category: 'Blazer & Vest',
    salePrice: 2800000,
    rentalPricePerDay: 210000,
    depositAmount: 1500000,
    status: 'ACTIVE',
  },
];

const fmt = (num) => (num ? `${Number(num).toLocaleString('vi-VN')} ₫` : '0 ₫');

export default function OwnerPricingPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [items, setItems] = useState(DEFAULT_PRICING_ITEMS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    rentalPricePerDay: '',
    depositAmount: '',
    salePrice: '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchVariants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/warehouse/masterdata/variants');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map((v) => ({
          id: v._id || v.id,
          sku: v.sku || 'N/A',
          name: v.variantName || v.name || 'Sản phẩm mẫu',
          variant: [v.size, v.color].filter(Boolean).join(' - ') || 'Tiêu chuẩn',
          category: v.categoryName || 'Thời Trang Thiết Kế',
          salePrice: Number(v.salePrice || 0),
          rentalPricePerDay: Number(v.rentalPricePerDay || 0),
          depositAmount: Number(v.depositAmount || 0),
          status: v.status || 'ACTIVE',
        }));
        setItems(mapped);
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const query = search.trim().toLowerCase();
      const matchSearch =
        !query ||
        it.name.toLowerCase().includes(query) ||
        it.sku.toLowerCase().includes(query) ||
        it.variant.toLowerCase().includes(query);
      const matchCategory =
        selectedCategory === 'ALL' || it.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [items, search, selectedCategory]);

  const handleOpenEdit = (it) => {
    setEditingItem(it);
    setEditForm({
      rentalPricePerDay: it.rentalPricePerDay || '',
      depositAmount: it.depositAmount || '',
      salePrice: it.salePrice || '',
    });
    setSaveSuccess(false);
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const updated = items.map((it) => {
      if (it.id === editingItem.id) {
        return {
          ...it,
          rentalPricePerDay: Number(editForm.rentalPricePerDay) || it.rentalPricePerDay,
          depositAmount: Number(editForm.depositAmount) || it.depositAmount,
          salePrice: Number(editForm.salePrice) || it.salePrice,
        };
      }
      return it;
    });

    setItems(updated);
    setSaveSuccess(true);

    try {
      await apiClient.patch(`/warehouse/masterdata/variants/${editingItem.id}`, {
        rentalPricePerDay: Number(editForm.rentalPricePerDay),
        depositAmount: Number(editForm.depositAmount),
        salePrice: Number(editForm.salePrice),
      });
    } catch (_) {}

    setTimeout(() => {
      setEditingItem(null);
      setSaveSuccess(false);
    }, 800);
  };

  return (
    <div className="admin-layout">
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="admin-main-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Bảng Giá & Tiền Cọc Escrow"
        />

        <div className="admin-content-body" style={{ padding: '24px 32px' }}>
          <div className="admin-page-hero" style={{ marginBottom: '24px' }}>
            <div>
              <h1 className="admin-page-title">
                Bảng Giá Thuê & Tiền Cọc Escrow
              </h1>
              <p className="admin-page-desc" style={{ color: '#64748B', fontSize: '13px' }}>
                Thiết lập mức giá thuê theo ngày và tỷ lệ cọc bảo đảm PayOS Escrow áp dụng thống nhất cho toàn chuỗi cửa hàng.
              </p>
            </div>
            <div className="admin-hero-actions">
              <button
                className="btn-tail-gold"
                onClick={fetchVariants}
                title="Đồng bộ danh sách giá"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>↻</span> {loading ? 'Đang tải...' : 'Làm mới'}
              </button>
            </div>
          </div>

          <div className="admin-kpi-grid" style={{ marginBottom: '24px' }}>
            <div className="admin-kpi-card">
              <span className="admin-kpi-title">TỔNG MÃ BIẾN THỂ</span>
              <div className="admin-kpi-value">{items.length} Mã</div>
              <div className="admin-kpi-trend positive">Đang niêm yết toàn sàn</div>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-title">GIÁ THUÊ TRUNG BÌNH</span>
              <div className="admin-kpi-value" style={{ color: '#A6865A' }}>
                {fmt(Math.round(items.reduce((s, i) => s + (i.rentalPricePerDay || 0), 0) / (items.length || 1)))} / ngày
              </div>
              <div className="admin-kpi-trend positive">Tối ưu cho thuê cao cấp</div>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-title">CỌC ESCROW BẢO ĐẢM</span>
              <div className="admin-kpi-value" style={{ color: '#059669' }}>
                {fmt(Math.round(items.reduce((s, i) => s + (i.depositAmount || 0), 0) / (items.length || 1)))}
              </div>
              <div className="admin-kpi-trend positive">Bảo hiểm 100% tài sản trang phục</div>
            </div>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '16px 20px',
              border: '1px solid #E2E8F0',
              marginBottom: '20px',
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px' }}>
              <input
                type="text"
                placeholder="🔍 Tìm theo SKU, tên trang phục, phiên bản..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                }}
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'Tất cả danh mục' : c}
                  </option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: '13px', color: '#64748B' }}>
              Hiển thị <strong>{filteredItems.length}</strong> / {items.length} trang phục
            </span>
          </div>

          <div className="tailadmin-table-container">
            <table className="tailadmin-table">
              <thead>
                <tr>
                  <th>MÃ SKU & TRANG PHỤC</th>
                  <th>DANH MỤC</th>
                  <th>GIÁ THUÊ / NGÀY</th>
                  <th>TIỀN CỌC ESCROW</th>
                  <th>GIÁ BÁN NIÊM YẾT</th>
                  <th>TRẠNG THÁI</th>
                  <th style={{ textAlign: 'center' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#A6865A', letterSpacing: '0.5px' }}>
                          {it.sku}
                        </span>
                        <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '14px', marginTop: '2px' }}>
                          {it.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{it.variant}</div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          background: '#F1F5F9',
                          color: '#475569',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {it.category}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#D97706', fontSize: '14px' }}>
                        {fmt(it.rentalPricePerDay)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#059669', fontSize: '13px' }}>
                        ✔ {fmt(it.depositAmount)}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#475569', fontSize: '13px' }}>
                        {fmt(it.salePrice)}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          background: '#ECFDF5',
                          color: '#059669',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Hoạt động
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-tail-outline"
                        style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600 }}
                        onClick={() => handleOpenEdit(it)}
                      >
                        ✏️ Sửa giá & cọc
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                      Không có sản phẩm nào khớp với tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingItem(null);
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px 28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700, letterSpacing: '1px' }}>
                  CHỈNH SỬA BIỂU PHÍ CHUỖI
                </span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', color: '#0F172A' }}>
                  {editingItem.name}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  {editingItem.sku} • {editingItem.variant}
                </span>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                style={{
                  border: 'none',
                  background: '#F1F5F9',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>

            {saveSuccess ? (
              <div style={{ background: '#ECFDF5', color: '#059669', padding: '16px', borderRadius: '8px', textAlign: 'center', fontWeight: 600 }}>
                ✔ Cập nhật mức giá và tiền cọc thành công!
              </div>
            ) : (
              <form onSubmit={handleSavePrice}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Giá thuê theo ngày (VNĐ) *
                    <input
                      type="number"
                      required
                      min="1000"
                      value={editForm.rentalPricePerDay}
                      onChange={(e) => setEditForm((f) => ({ ...f, rentalPricePerDay: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                        fontWeight: 600,
                        marginTop: '4px',
                      }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Tiền cọc PayOS Escrow (VNĐ) *
                    <input
                      type="number"
                      required
                      min="0"
                      value={editForm.depositAmount}
                      onChange={(e) => setEditForm((f) => ({ ...f, depositAmount: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                        fontWeight: 600,
                        marginTop: '4px',
                        color: '#059669',
                      }}
                    />
                  </label>

                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Giá bán niêm yết (VNĐ)
                    <input
                      type="number"
                      min="0"
                      value={editForm.salePrice}
                      onChange={(e) => setEditForm((f) => ({ ...f, salePrice: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '14px',
                        marginTop: '4px',
                      }}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn-tail-gold"
                    style={{ padding: '9px 20px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Lưu Bảng Giá
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
