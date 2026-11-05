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

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const all = await productVariantService.list();
      setVariants(all.filter((variant) => idOf(variant.productId) === idOf(product) && !variant.isDeleted));
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [product]);
  useEffect(() => { load(); }, [load]);

  const openEditor = (mode, variant = null) => setEditor({ mode, variant, form: {
    color: variant?.color || '', size: variant?.size || '', status: variant?.status || 'active',
    attributesText: JSON.stringify(variant?.attributes || {}, null, 2),
  } });
  const sku = useMemo(() => {
    try { return previewSku(product, { ...editor?.form, attributes: JSON.parse(editor?.form.attributesText || '{}') }); }
    catch { return 'Thuộc tính phải là JSON hợp lệ'; }
  }, [editor, product]);

  const save = async (event) => {
    event.preventDefault();
    let attributes;
    try { attributes = JSON.parse(editor.form.attributesText || '{}'); }
    catch { setError('Thuộc tính cần nhập theo định dạng JSON hợp lệ.'); return; }
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) { setError('Thuộc tính phải là một object JSON.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { productId: idOf(product), color: editor.form.color, size: editor.form.size, status: editor.form.status, attributes };
      if (editor.mode === 'edit') await productVariantService.update(editor.variant._id, payload);
      else await productVariantService.create(payload);
      setEditor(null);
      await load();
      await onChanged?.();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };
  const remove = async (variant) => {
    if (!window.confirm(`Xóa biến thể ${variant.sku}?`)) return;
    try { setError(''); await productVariantService.remove(variant._id); await load(); await onChanged?.(); }
    catch (removeError) { setError(removeError.message); }
  };

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal wm-product-variants-modal" role="dialog" aria-modal="true" aria-labelledby="product-variants-title">
      <header><div><span>QUẢN LÝ BIẾN THỂ</span><h2 id="product-variants-title">{product.productCode} · {product.name}</h2></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      <div className="wm-variant-toolbar"><p>{variants.length} biến thể</p><button type="button" className="wm-primary-button" onClick={() => openEditor('create')}>+ Thêm biến thể</button></div>
      <div className="wm-table-wrap"><table><thead><tr><th>SKU</th><th>Màu</th><th>Kích thước</th><th>Thuộc tính</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="6">Đang tải...</td></tr> : variants.length ? variants.map((variant) => <tr key={variant._id}><td><strong>{variant.sku}</strong></td><td>{variant.color || '—'}</td><td>{variant.size || '—'}</td><td>{Object.entries(variant.attributes || {}).map(([key, value]) => `${key}: ${value}`).join(', ') || '—'}</td><td>{variant.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}</td><td className="wm-actions"><button type="button" className="secondary" onClick={() => openEditor('view', variant)}>Xem</button><button type="button" className="secondary" onClick={() => openEditor('edit', variant)}>Sửa</button><button type="button" className="danger" onClick={() => remove(variant)}>Xóa</button></td></tr>) : <tr><td colSpan="6">Sản phẩm chưa có biến thể.</td></tr>}
      </tbody></table></div>
      <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>
    </section>
    {editor && <div className="wm-modal-backdrop wm-variant-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
      <section className="wm-crud-modal wm-variant-editor" role="dialog" aria-modal="true" aria-labelledby="variant-editor-title">
        <header><div><span>{editor.mode === 'create' ? 'THÊM BIẾN THỂ' : editor.mode === 'edit' ? 'SỬA BIẾN THỂ' : 'CHI TIẾT BIẾN THỂ'}</span><h2 id="variant-editor-title">{editor.variant?.sku || 'Biến thể mới'}</h2></div><button type="button" className="wm-modal-close" onClick={() => setEditor(null)} aria-label="Đóng"><X size={20} /></button></header>
        {editor.mode === 'view' ? <div className="wm-detail-grid"><div><small>SKU</small><strong>{editor.variant.sku}</strong></div><div><small>Màu</small><strong>{editor.variant.color || '—'}</strong></div><div><small>Kích thước</small><strong>{editor.variant.size || '—'}</strong></div><div><small>Thuộc tính</small><strong>{JSON.stringify(editor.variant.attributes || {})}</strong></div><div><small>Trạng thái</small><strong>{editor.variant.status}</strong></div></div> : <form className="wm-form" onSubmit={save}>
          <label>Màu<input value={editor.form.color} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, color: event.target.value } })} /></label>
          <label>Kích thước<input value={editor.form.size} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, size: event.target.value } })} /></label>
          <label>SKU tự động<input readOnly value={sku} /></label>
          <label>Trạng thái<select value={editor.form.status} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, status: event.target.value } })}><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label>
          <label className="wm-variant-attributes">Thuộc tính (JSON)<textarea rows="4" value={editor.form.attributesText} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, attributesText: event.target.value } })} placeholder={'{ "material": "cotton" }'} /></label>
          <footer><button type="button" className="secondary" onClick={() => setEditor(null)}>Hủy</button><button disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button></footer>
        </form>}
        {editor.mode === 'view' && <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={() => setEditor(null)}>Đóng</button></footer>}
      </section>
    </div>}
  </div>;
}
