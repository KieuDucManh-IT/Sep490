import React, { useCallback, useEffect, useRef, useState } from 'react';
import BranchSidebar from '../../components/BranchSidebar';
import { fetchAllProducts } from '../../services/productService';
import SearchableSelect from '../../components/SearchableSelect';
import ShopPagination from '../../components/ShopPagination';
import {
  fetchAllVariantsWithProductNames,
  createVariant,
  updateVariant,
  deleteVariant,
} from '../../services/productVariantService';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopProducts.css';
import '../../styles/ShopInventory.css';

const VARIANT_STATUS_LABELS = { active: 'Hoạt động', inactive: 'Ngừng', maintenance: 'Bảo trì' };
const blankVariant = { productId: '', size: '', color: '', condition: 'new', quantity: '', status: 'active' };

//duc 2026-10-16: Trang quản lý tồn kho theo từng variant (cỡ & màu) của sản phẩm.
export default function ShopInventoryPage() {
  // Toàn bộ variants sau khi ghép tên sản phẩm (source of truth phía client)
  const allVariantsRef = useRef([]);

  const [variants, setVariants] = useState([]);       // slice hiện tại sau lọc + phân trang
  const [products, setProducts] = useState([]);        // dùng cho dropdown
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(blankVariant);
  const [editingVariant, setEditingVariant] = useState(null); // { productId, variantId }

  //duc 2026-10-16: Tải tất cả sản phẩm qua productService để dùng dropdown.
  const loadAllProducts = useCallback(async () => {
    try {
      const data = await fetchAllProducts();
      setProducts(data);
      return data;
    } catch (err) {
      setError(err.message || 'Không tải được danh sách sản phẩm');
      return [];
    }
  }, []);

  //duc 2026-10-16: Tải tất cả variants qua productVariantService, ghép productName.
  const loadAllVariants = useCallback(async (productList) => {
    setLoading(true);
    setError('');
    try {
      const prods = productList ?? (await loadAllProducts());
      const all = await fetchAllVariantsWithProductNames(prods);
      allVariantsRef.current = all;
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu tồn kho');
    } finally {
      setLoading(false);
    }
  }, [loadAllProducts]);

  //duc 2026-10-16: Áp dụng filter + phân trang trên allVariantsRef mỗi khi filter/page thay đổi.
  const applyFilter = useCallback(() => {
    let filtered = allVariantsRef.current;
    if (filterProduct) filtered = filtered.filter((v) => String(v.productId) === filterProduct);
    if (filterStatus) filtered = filtered.filter((v) => v.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((v) =>
        v.productName?.toLowerCase().includes(q) ||
        v.color?.toLowerCase().includes(q) ||
        String(v.size).includes(q)
      );
    }
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, pages);
    setVariants(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize));
    setPagination({ page: currentPage, pages, total });
  }, [search, filterProduct, filterStatus, page, pageSize]);

  // Khởi tạo lần đầu
  useEffect(() => {
    (async () => {
      const prods = await loadAllProducts();
      await loadAllVariants(prods);
      // applyFilter sẽ chạy qua effect dưới
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mỗi khi all variants hoặc filter thay đổi → re-apply
  useEffect(() => { applyFilter(); }, [applyFilter, loading]);

  // Reset page về 1 khi filter thay đổi
  useEffect(() => { setPage(1); }, [search, filterProduct, filterStatus]);

  const reload = async () => {
    const prods = await loadAllProducts();
    await loadAllVariants(prods);
  };

  //duc 2026-10-16: Mở form thêm variant mới hoặc sửa variant đã có.
  const openForm = (variant) => {
    setError('');
    setNotice('');
    if (variant) {
      setEditingVariant({ productId: String(variant.productId), variantId: variant._id });
      setForm({
        productId: String(variant.productId),
        size: variant.size || '',
        color: variant.color || '',
        condition: variant.condition || 'new',
        quantity: variant.quantity ?? '',
        status: variant.status || 'active',
      });
    } else {
      setEditingVariant(null);
      setForm(blankVariant);
    }
    setIsFormOpen(true);
  };

  const updateField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const saveVariant = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const prodId = editingVariant?.productId || form.productId;
      if (!prodId) throw new Error('Vui lòng chọn sản phẩm');
      const payload = {
        size: Number(form.size),
        color: form.color.trim(),
        condition: form.condition,
        quantity: Number(form.quantity),
        status: form.status,
      };
      if (editingVariant?.variantId) {
        await updateVariant(prodId, editingVariant.variantId, payload);
        setNotice('Đã cập nhật variant.');
      } else {
        await createVariant(prodId, payload);
        setNotice('Đã thêm variant.');
      }
      setIsFormOpen(false);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeVariant = async (variant) => {
    if (!window.confirm(`Xóa variant cỡ ${variant.size} - ${variant.color} của "${variant.productName}"?`)) return;
    setError('');
    try {
      await deleteVariant(String(variant.productId), variant._id);
      setNotice('Đã xóa variant.');
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="shop-dashboard-layout">
      <BranchSidebar />
      <main className="shop-main-content shop-inventory-page">
        <header className="shop-header">
          <div>
            <h1>Tồn kho</h1>
            <p>Quản lý số lượng theo cỡ &amp; màu của từng sản phẩm</p>
          </div>
          <button className="shop-product-primary" onClick={() => openForm(null)}>
            + Thêm variant
          </button>
        </header>

        <section className="shop-products-panel">
          {/* Toolbar */}
          <div className="shop-products-toolbar">
            <strong>{pagination.total} variant</strong>
            <div className="shop-products-filters">
              <input
                placeholder="Tìm tên sản phẩm, màu, cỡ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} aria-label="Lọc sản phẩm">
                <option value="">Tất cả sản phẩm</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Lọc trạng thái">
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Ngừng</option>
                <option value="maintenance">Bảo trì</option>
              </select>
            </div>
          </div>

          {notice && <div className="shop-products-notice">{notice}</div>}
          {error && <div className="shop-products-error">{error}</div>}

          {loading ? (
            <p className="shop-products-empty">Đang tải tồn kho…</p>
          ) : variants.length === 0 ? (
            <p className="shop-products-empty">Chưa có dữ liệu tồn kho.</p>
          ) : (
            <div className="shop-products-table-wrap">
              <table className="shop-products-table">
                <thead>
                  <tr>
                    <th>Tên sản phẩm</th>
                    <th>Cỡ &amp; Màu</th>
                    <th>Tổng SL</th>
                    <th>Đang thuê</th>
                    <th>Đã đặt</th>
                    <th>Khả dụng</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => {
                    const rented = 0;  // tạm thời chờ tích hợp order
                    const booked = 0;  // tạm thời chờ tích hợp order
                    const available = Math.max(0, v.quantity - rented - booked);
                    return (
                      <tr key={v._id}>
                        <td><strong>{v.productName}</strong></td>
                        <td>
                          <span className="inv-variant-chip">Cỡ {v.size}</span>
                          <span className="inv-variant-chip inv-color-chip">{v.color}</span>
                        </td>
                        <td><strong>{v.quantity}</strong></td>
                        <td><span className="inv-rented">{rented}</span></td>
                        <td><span className="inv-booked">{booked}</span></td>
                        <td>
                          <span className={`inv-available ${available === 0 ? 'inv-zero' : ''}`}>
                            {available}
                          </span>
                        </td>
                        <td>
                          <span className={`shop-product-status status-${v.status}`}>
                            {VARIANT_STATUS_LABELS[v.status] || v.status}
                          </span>
                        </td>
                        <td className="shop-product-actions">
                          <button onClick={() => openForm(v)}>Sửa</button>
                          <button className="shop-product-delete" onClick={() => removeVariant(v)}>Xóa</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Phân trang */}
          <ShopPagination page={pagination.page} pages={pagination.pages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </section>

        {/* Modal thêm/sửa variant */}
        {isFormOpen && (
          <div
            className="shop-product-modal-backdrop"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}
          >
            <form className="shop-product-modal" onSubmit={saveVariant}>
              <div className="shop-product-modal-heading">
                <h2>{editingVariant?.variantId ? 'Sửa variant' : 'Thêm variant'}</h2>
                <button type="button" aria-label="Đóng" onClick={() => setIsFormOpen(false)}>×</button>
              </div>
              {error && <div className="shop-products-error">{error}</div>}
              <div className="shop-product-form-grid">
                {/* Chọn sản phẩm nếu tạo mới */}
                {!editingVariant?.variantId && (
                  <label className="shop-product-form-wide">
                    Sản phẩm
                    <SearchableSelect value={form.productId} onChange={(productId) => setForm((current) => ({ ...current, productId }))} options={products.filter((product) => product.status === 'active').map((p) => ({ value: p._id, label: `${p.sku ? `${p.sku} - ` : ''}${p.name}` }))} placeholder="Chọn sản phẩm" searchPlaceholder="Tìm theo mã hoặc tên sản phẩm" emptyText="Chưa có sản phẩm active" />
                  </label>
                )}
                <label>Cỡ (số)<input name="size" type="number" min="1" value={form.size} onChange={updateField} required /></label>
                <label>Màu<input name="color" value={form.color} onChange={updateField} required /></label>
                <label>
                  Tình trạng
                  <select name="condition" value={form.condition} onChange={updateField}>
                    <option value="new">Mới</option>
                    <option value="like-new">Như mới</option>
                    <option value="good">Tốt</option>
                    <option value="fair">Khá</option>
                  </select>
                </label>
                <label>Số lượng<input name="quantity" type="number" min="0" value={form.quantity} onChange={updateField} required /></label>
                <label>
                  Trạng thái
                  <select name="status" value={form.status} onChange={updateField}>
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Ngừng</option>
                    <option value="maintenance">Bảo trì</option>
                  </select>
                </label>
              </div>
              <div className="shop-product-modal-actions">
                <button type="button" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button className="shop-product-primary" disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
