import React, { useCallback, useEffect, useState } from 'react';
import ShopSidebar from '../../components/ShopSidebar';
import ShopPagination from '../../components/ShopPagination';
import SearchableSelect from '../../components/SearchableSelect';
import { fetchCategories } from '../../services/categoryService';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../services/productService';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopProducts.css';


const blankProduct = {
  sku: '', name: '', brand: '', material: '', categoryId: '', tag: 'sale',
  salePrice: '', rentalPricePerDay: '', deposit: '0', discount: '0', images: '',
};

//duc 2026-10-16: Chuyển form string thành payload đúng kiểu dữ liệu backend yêu cầu.
const toPayload = (form, categories) => {
  const catObj = categories.find((c) => c._id === form.categoryId);
  const categoryArr = catObj ? [catObj.name] : (form.categoryId ? [form.categoryId] : []);
  return {
    sku: form.sku.trim(),
    name: form.name.trim(),
    ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
    ...(form.material.trim() ? { material: form.material.trim() } : {}),
    category: categoryArr,
    tag: form.tag,
    ...(form.salePrice !== '' ? { salePrice: Number(form.salePrice) } : {}),
    ...(form.rentalPricePerDay !== '' ? { rentalPricePerDay: Number(form.rentalPricePerDay) } : {}),
    deposit: Number(form.deposit || 0),
    discount: Number(form.discount || 0),
    images: form.images.split('\n').map((s) => s.trim()).filter(Boolean),
  };
};

const TAG_LABELS = { sale: 'Bán', rental: 'Cho thuê', both: 'Bán & Cho thuê' };
const STATUS_LABELS = { pending: 'Chờ duyệt', active: 'Đang bán', inactive: 'Ẩn', rejected: 'Từ chối' };

//duc 2026-10-16: Hiển thị danh sách và thao tác CRUD product với phân trang, lọc nhãn và loại.
export default function ShopProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(blankProduct);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  //duc 2026-10-16: Tải category qua categoryService để hiện dropdown chọn loại.
  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (_) { /* không block UI nếu categories lỗi */ }
  }, []);

  //duc 2026-10-16: Tải product qua productService với tìm kiếm, lọc và phân trang.
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, pagination: pg } = await fetchProducts({
        search, tag: filterTag, status: filterStatus, page, limit: pageSize,
      });
      setProducts(data);
      setPagination(pg);
    } catch (err) {
      setError(err.message || 'Không kết nối được backend');
    } finally {
      setLoading(false);
    }
  }, [search, filterTag, filterStatus, page, pageSize]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { setPage(1); }, [search, filterTag, filterStatus, filterCategory]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  //duc 2026-10-16: Lọc thêm theo loại (category) ở phía client vì backend lưu category dạng string[].
  const visibleProducts = filterCategory
    ? products.filter((p) => (p.category || []).includes(filterCategory))
    : products;

  const uniqueCategories = [...new Set(products.flatMap((p) => p.category || []))].filter(Boolean);

  //duc 2026-10-16: Mở form tạo mới hoặc điền dữ liệu product để chỉnh sửa.
  const openForm = (product) => {
    setError('');
    setNotice('');
    setEditingId(product?._id || null);
    if (product) {
      const catName = (product.category || [])[0] || '';
      const catObj = categories.find((c) => c.name === catName);
      setForm({
        sku: product.sku || '', name: product.name || '', brand: product.brand || '',
        material: product.material || '', categoryId: catObj?._id || catName,
        tag: product.tag || 'sale', salePrice: product.salePrice ?? '',
        rentalPricePerDay: product.rentalPricePerDay ?? '', deposit: product.deposit ?? 0,
        discount: product.discount ?? 0, images: (product.images || []).join('\n'),
      });
    } else {
      setForm(blankProduct);
    }
    setIsFormOpen(true);
  };

  //duc 2026-10-16: Gửi create/update product qua productService, sau đó tải lại danh sách.
  const saveProduct = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = toPayload(form, categories);
      if (editingId) {
        await updateProduct(editingId, payload);
        setNotice('Đã cập nhật sản phẩm.');
      } else {
        await createProduct(payload);
        setNotice('Đã tạo sản phẩm mới.');
      }
      setIsFormOpen(false);
      await loadProducts();
    } catch (err) {
      setError(err.message || 'Không lưu được sản phẩm');
    } finally {
      setSaving(false);
    }
  };

  //duc 2026-10-16: Xóa mềm product sau khi chủ shop xác nhận.
  const removeProduct = async (product) => {
    if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) return;
    setError('');
    try {
      await deleteProduct(product._id);
      setNotice('Đã xóa sản phẩm.');
      await loadProducts();
    } catch (err) {
      setError(err.message || 'Không xóa được sản phẩm');
    }
  };

  const updateField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="shop-dashboard-layout">
      <ShopSidebar />
      <main className="shop-main-content shop-products-page">
        <header className="shop-header">
          <div>
            <h1>Sản phẩm</h1>
            <p>Quản lý sản phẩm của gian hàng</p>
          </div>
          <button className="shop-product-primary" onClick={() => openForm(null)}>+ Thêm sản phẩm</button>
        </header>

        <section className="shop-products-panel">
          {/* Toolbar */}
          <div className="shop-products-toolbar">
            <strong>{pagination.total} sản phẩm</strong>
            <div className="shop-products-filters">
              <input
                aria-label="Tìm sản phẩm"
                placeholder="Tìm theo tên, SKU, thương hiệu"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} aria-label="Lọc nhãn">
                <option value="">Tất cả nhãn</option>
                <option value="sale">Bán</option>
                <option value="rental">Cho thuê</option>
                <option value="both">Bán &amp; Cho thuê</option>
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Lọc trạng thái">
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ duyệt</option>
                <option value="active">Đang bán</option>
                <option value="inactive">Ẩn</option>
                <option value="rejected">Từ chối</option>
              </select>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} aria-label="Lọc loại">
                <option value="">Tất cả loại</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {notice && <div className="shop-products-notice">{notice}</div>}
          {error && <div className="shop-products-error">{error}</div>}

          {loading ? (
            <p className="shop-products-empty">Đang tải sản phẩm…</p>
          ) : visibleProducts.length === 0 ? (
            <p className="shop-products-empty">Chưa có sản phẩm. Hãy thêm sản phẩm đầu tiên.</p>
          ) : (
            <div className="shop-products-table-wrap">
              <table className="shop-products-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Nhãn</th>
                    <th>Loại</th>
                    <th>Tổng SL</th>
                    <th>Giá bán</th>
                    <th>Giá thuê/ngày</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => (
                    <tr key={product._id}>
                      <td>
                        <strong>{product.name}</strong>
                        <small>{product.sku}{product.brand ? ` · ${product.brand}` : ''}</small>
                      </td>
                      <td>
                        <span className={`shop-tag-badge tag-${product.tag}`}>
                          {TAG_LABELS[product.tag] || product.tag}
                        </span>
                      </td>
                      <td>{(product.category || []).join(', ') || '—'}</td>
                      <td><strong>{product.totalQuantity ?? 0}</strong></td>
                      <td>{product.salePrice == null ? '—' : `${Number(product.salePrice).toLocaleString('vi-VN')} ₫`}</td>
                      <td>{product.rentalPricePerDay == null ? '—' : `${Number(product.rentalPricePerDay).toLocaleString('vi-VN')} ₫`}</td>
                      <td>
                        <span className={`shop-product-status status-${product.status}`}>
                          {STATUS_LABELS[product.status] || product.status}
                        </span>
                      </td>
                      <td className="shop-product-actions">
                        <button onClick={() => openForm(product)}>Sửa</button>
                        <button className="shop-product-delete" onClick={() => removeProduct(product)}>Xóa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Phân trang */}
          <ShopPagination page={pagination.page} pages={pagination.pages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </section>

        {/* Modal thêm/sửa sản phẩm */}
        {isFormOpen && (
          <div
            className="shop-product-modal-backdrop"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}
          >
            <form className="shop-product-modal" onSubmit={saveProduct}>
              <div className="shop-product-modal-heading">
                <h2>{editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
                <button type="button" aria-label="Đóng" onClick={() => setIsFormOpen(false)}>×</button>
              </div>
              {error && <div className="shop-products-error">{error}</div>}
              <div className="shop-product-form-grid">
                <label>SKU<input name="sku" value={form.sku} onChange={updateField} required /></label>
                <label>Tên sản phẩm<input name="name" value={form.name} onChange={updateField} required /></label>
                <label>
                  Nhãn
                  <select name="tag" value={form.tag} onChange={updateField}>
                    <option value="sale">Bán</option>
                    <option value="rental">Cho thuê</option>
                    <option value="both">Bán và cho thuê</option>
                  </select>
                </label>
                <label>
                  Loại (Danh mục)
                  <SearchableSelect value={form.categoryId} onChange={(categoryId) => setForm((current) => ({ ...current, categoryId }))} options={categories.map((category) => ({ value: category._id, label: category.name }))} placeholder="Chọn loại" searchPlaceholder="Tìm loại sản phẩm" emptyText="Chưa có danh mục nào" />
                </label>
                <label>Thương hiệu<input name="brand" value={form.brand} onChange={updateField} /></label>
                <label>Chất liệu<input name="material" value={form.material} onChange={updateField} /></label>
                <label>
                  Giá bán
                  <input name="salePrice" type="number" min="0" value={form.salePrice} onChange={updateField} required={form.tag !== 'rental'} />
                </label>
                <label>
                  Giá thuê/ngày
                  <input name="rentalPricePerDay" type="number" min="0" value={form.rentalPricePerDay} onChange={updateField} required={form.tag !== 'sale'} />
                </label>
                <label>Tiền cọc<input name="deposit" type="number" min="0" value={form.deposit} onChange={updateField} /></label>
                <label>Giảm giá (%)<input name="discount" type="number" min="0" max="100" value={form.discount} onChange={updateField} /></label>
                <label className="shop-product-form-wide">
                  Ảnh <small>(mỗi URL một dòng)</small>
                  <textarea name="images" rows="2" value={form.images} onChange={updateField} />
                </label>
              </div>
              <div className="shop-product-modal-actions">
                <button type="button" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button className="shop-product-primary" disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Lưu sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
