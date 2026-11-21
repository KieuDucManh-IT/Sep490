import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import productVariantService from '../services/masterdata/productVariantService';
import '../styles/WarehouseManager.css';

const idOf = (value) => String(value?._id || value || '');
const skuPart = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const previewSku = (product, form) => [product.productCode, form.color, form.size, ...Object.entries(form.attributes || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}-${value}`)].map(skuPart).filter(Boolean).join('-');

export default function ProductVariantsModal({ product, onClose, onChanged }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const all = await productVariantService.list();
      setVariants(all.filter((variant) => idOf(variant.productId) === idOf(product) && !variant.isDeleted));
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [product]);
  useEffect(() => { load(); }, [load]);

  // TASK-014 A4: form không còn "Thuộc tính"; field vẫn giữ trong model, thuộc tính cũ vẫn tính vào SKU xem trước.
  const openEditor = (mode, variant = null) => setEditor({ mode, variant, form: {
    color: variant?.color || '', size: variant?.size || '', status: variant?.status || 'active',
  } });
  const sku = useMemo(() => previewSku(product, { ...editor?.form, attributes: editor?.variant?.attributes || {} }), [editor, product]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { productId: idOf(product), color: editor.form.color, size: editor.form.size, status: editor.form.status };
      if (editor.mode === 'edit') await productVariantService.update(editor.variant._id, payload);
      else await productVariantService.create(payload);
      setEditor(null);
      await load();
      await onChanged?.();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };
  const confirmRemove = async () => {
    if (!confirmDelete) return;
    try {
      setError('');
      await productVariantService.remove(confirmDelete._id);
      setConfirmDelete(null);
      await load();
      await onChanged?.();
    } catch (removeError) {
      setError(removeError.message);
    }
  };

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal wm-product-variants-modal" role="dialog" aria-modal="true" aria-labelledby="product-variants-title">
      <header><div><span>QUẢN LÝ BIẾN THỂ</span><h2 id="product-variants-title">{product.productCode} · {product.name}</h2></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      <div className="wm-variant-toolbar"><p>{variants.length} biến thể</p><button type="button" className="wm-primary-button" onClick={() => openEditor('create')}>+ Thêm biến thể</button></div>
      <div className="wm-table-wrap"><table><thead><tr><th>SKU</th><th>Màu</th><th>Kích thước</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="5">Đang tải...</td></tr> : variants.length ? variants.map((variant) => <tr key={variant._id}><td><strong>{variant.sku}</strong></td><td>{variant.color || '—'}</td><td>{variant.size || '—'}</td><td>{variant.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}</td><td className="wm-actions"><button type="button" className="secondary" onClick={() => openEditor('view', variant)}>Xem</button><button type="button" className="secondary" onClick={() => openEditor('edit', variant)}>Sửa</button><button type="button" className="danger" onClick={() => setConfirmDelete(variant)}>Xóa</button></td></tr>) : <tr><td colSpan="5">Sản phẩm chưa có biến thể.</td></tr>}
      </tbody></table></div>
      <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>
    </section>
    {confirmDelete && (
      <div className="wm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
        <section className="wm-crud-modal" style={{ maxWidth: '420px', padding: '24px' }} role="dialog" aria-modal="true">
          <header style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#171717' }}>Xác nhận xóa biến thể</h3>
          </header>
          <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px 0' }}>
            Bạn có chắc chắn muốn xóa biến thể <strong>{confirmDelete.sku}</strong>? Thao tác này không thể hoàn tác.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="secondary" onClick={() => setConfirmDelete(null)}>Hủy bỏ</button>
            <button type="button" className="danger" onClick={confirmRemove}>Xóa vĩnh viễn</button>
          </div>
        </section>
      </div>
    )}
    {editor && <div className="wm-modal-backdrop wm-variant-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
      <section className="wm-crud-modal wm-variant-editor" role="dialog" aria-modal="true" aria-labelledby="variant-editor-title">
        <header><div><span>{editor.mode === 'create' ? 'THÊM BIẾN THỂ' : editor.mode === 'edit' ? 'SỬA BIẾN THỂ' : 'CHI TIẾT BIẾN THỂ'}</span><h2 id="variant-editor-title">{editor.variant?.sku || 'Biến thể mới'}</h2></div><button type="button" className="wm-modal-close" onClick={() => setEditor(null)} aria-label="Đóng"><X size={20} /></button></header>
        {editor.mode === 'view' ? <div className="wm-detail-grid"><div><small>SKU</small><strong>{editor.variant.sku}</strong></div><div><small>Màu</small><strong>{editor.variant.color || '—'}</strong></div><div><small>Kích thước</small><strong>{editor.variant.size || '—'}</strong></div><div><small>Trạng thái</small><strong>{editor.variant.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}</strong></div></div> : <form className="wm-form" onSubmit={save}>
          <label>Màu<input value={editor.form.color} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, color: event.target.value } })} /></label>
          <label>Kích thước<input value={editor.form.size} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, size: event.target.value } })} /></label>
          <label>SKU tự động<input readOnly value={sku} /></label>
          <label>Trạng thái<select value={editor.form.status} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, status: event.target.value } })}><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label>
          <footer><button type="button" className="secondary" onClick={() => setEditor(null)}>Hủy</button><button disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button></footer>
        </form>}
        {editor.mode === 'view' && <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={() => setEditor(null)}>Đóng</button></footer>}
      </section>
    </div>}
  </div>;
}
