import React, { useCallback, useEffect, useState } from 'react';
import OwnerSidebar from '../../components/OwnerSidebar';
import ShopPagination from '../../components/ShopPagination';
import { fetchProducts, updateProduct } from '../../services/productService';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopProducts.css';

const fmt = (val) =>
  val == null || val === '' ? '—' : `${Number(val).toLocaleString('vi-VN')} ₫`;

const blankPrice = { salePrice: '', discount: '0', rentalPricePerDay: '', deposit: '0' };

//duc 2026-10-16: Trang quản lý giá sản phẩm: giá bán, giảm giá, giá thuê/ngày, tiền cọc.
export default function ShopPricingPage() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(blankPrice);

  //duc 2026-10-16: Tải sản phẩm qua productService với tìm kiếm, lọc nhãn, phân trang.
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, pagination: pg } = await fetchProducts({
        search, tag: filterTag, page, limit: pageSize,
      });
      setProducts(data);
      setPagination(pg);
    } catch (err) {
      setError(err.message || 'Không kết nối được backend');
    } finally {
      setLoading(false);
    }
  }, [search, filterTag, page, pageSize]);

  useEffect(() => { setPage(1); }, [search, filterTag]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  //duc 2026-10-16: Mở modal chỉnh sửa giá của sản phẩm được chọn.
  const openForm = (product) => {
    setError('');
    setNotice('');
    setEditingProduct(product);
    setForm({
      salePrice: product.salePrice ?? '',
      discount: product.discount ?? 0,
      rentalPricePerDay: product.rentalPricePerDay ?? '',
      deposit: product.deposit ?? 0,
    });
    setIsFormOpen(true);
  };

  const updateField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  //duc 2026-10-16: Lưu chỉ các trường giá qua productService PATCH, không chạm trường khác.
  const savePrice = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...(form.salePrice !== '' ? { salePrice: Number(form.salePrice) } : {}),
        discount: Number(form.discount || 0),
        ...(form.rentalPricePerDay !== '' ? { rentalPricePerDay: Number(form.rentalPricePerDay) } : {}),
        deposit: Number(form.deposit || 0),
      };
      await updateProduct(editingProduct._id, payload);
      setIsFormOpen(false);
      setNotice(`Đã cập nhật giá cho "${editingProduct.name}".`);
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shop-dashboard-layout">
      <OwnerSidebar />
      <main className="shop-main-content shop-products-page">
        <header className="shop-header">
          <div>
            <h1>Bảng giá</h1>
            <p>Quản lý giá bán, giảm giá, giá thuê và tiền cọc của từng sản phẩm</p>
          </div>
        </header>

        <section className="shop-products-panel">
          {/* Toolbar */}
          <div className="shop-products-toolbar">
            <strong>{pagination.total} sản phẩm</strong>
            <div className="shop-products-filters">
              <input
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
            </div>
          </div>

          {notice && <div className="shop-products-notice">{notice}</div>}
          {error && <div className="shop-products-error">{error}</div>}

          {loading ? (
            <p className="shop-products-empty">Đang tải bảng giá…</p>
          ) : products.length === 0 ? (
            <p className="shop-products-empty">Không tìm thấy sản phẩm.</p>
          ) : (
            <div className="shop-products-table-wrap">
              <table className="shop-products-table">
                <thead>
                  <tr>
                    <th>Tên sản phẩm</th>
                    <th>Giá bán</th>
                    <th>Giảm giá</th>
                    <th>Giá thuê/ngày</th>
                    <th>Tiền cọc</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small>{p.sku}{p.brand ? ` · ${p.brand}` : ''}</small>
                      </td>
                      <td>{fmt(p.salePrice)}</td>
                      <td>
                        {p.discount ? (
                          <span className="pricing-discount-badge">{p.discount}%</span>
                        ) : '—'}
                      </td>
                      <td>{fmt(p.rentalPricePerDay)}</td>
                      <td>{fmt(p.deposit)}</td>
                      <td className="shop-product-actions">
                        <button onClick={() => openForm(p)}>Sửa giá</button>
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

        {/* Modal sửa giá */}
        {isFormOpen && editingProduct && (
          <div
            className="shop-product-modal-backdrop"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}
          >
            <form className="shop-product-modal" onSubmit={savePrice}>
              <div className="shop-product-modal-heading">
                <h2>Sửa giá — {editingProduct.name}</h2>
                <button type="button" aria-label="Đóng" onClick={() => setIsFormOpen(false)}>×</button>
              </div>
              {error && <div className="shop-products-error">{error}</div>}
              <div className="shop-product-form-grid">
                <label>
                  Giá bán (₫)
                  <input
                    name="salePrice"
                    type="number"
                    min="0"
                    value={form.salePrice}
                    onChange={updateField}
                    placeholder="Để trống nếu không bán"
                  />
                </label>
                <label>
                  Giảm giá (%)
                  <input name="discount" type="number" min="0" max="100" value={form.discount} onChange={updateField} />
                </label>
                <label>
                  Giá thuê/ngày (₫)
                  <input
                    name="rentalPricePerDay"
                    type="number"
                    min="0"
                    value={form.rentalPricePerDay}
                    onChange={updateField}
                    placeholder="Để trống nếu không cho thuê"
                  />
                </label>
                <label>
                  Tiền cọc (₫)
                  <input name="deposit" type="number" min="0" value={form.deposit} onChange={updateField} />
                </label>
              </div>
              <div className="shop-product-modal-actions">
                <button type="button" onClick={() => setIsFormOpen(false)}>Hủy</button>
                <button className="shop-product-primary" disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Lưu giá'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
