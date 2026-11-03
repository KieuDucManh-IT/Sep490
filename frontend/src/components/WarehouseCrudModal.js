import React, { useState } from 'react';
import { X } from 'lucide-react';
import MultiSelect from './MultiSelect';
import '../styles/WarehouseManager.css';

const getInitialValues = (config, record) => Object.fromEntries(config.fields.map(([key]) => {
  const value = record?.[key];
  const normalized = config.multipleFields?.includes(key)
    ? (Array.isArray(value) ? value.map((item) => item?._id || item).filter(Boolean) : value ? [value?._id || value] : [])
    : Array.isArray(value) ? (value[0]?._id || value[0] || '') : (value?._id || value || '');
  return [key, key === 'aiTryOn' && normalized !== '' ? String(normalized) : normalized];
}));
const display = (value) => value && typeof value === 'object' ? value.FullName || value.name || value.code || value._id : value ?? '—';

export default function WarehouseCrudModal({ config, mode, record, choices, onClose, onSave }) {
  const [form, setForm] = useState(() => getInitialValues(config, record));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState(() => (record?.images || []).map((image) => ({ ...image })));
  const [variants, setVariants] = useState(() => (record?.variants || []).map((variant) => ({ ...variant })));
  const readOnly = mode === 'view';
  const isProduct = config.service === 'products';

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    const payload = {};
    config.fields.forEach(([key, , type, required]) => {
      const fieldRequired = required || (config.service === 'inventoryLocations' && key === 'shopId' && form.type === 'store');
      if (config.multipleFields?.includes(key)) {
        if (form[key]?.length) payload[key] = form[key];
      } else if (form[key] !== '') payload[key] = type === 'number' ? Number(form[key]) : key === 'aiTryOn' ? form[key] === 'true' : form[key];
      else if (!fieldRequired && type === 'relation') payload[key] = null;
      else if (!fieldRequired && type === 'text') payload[key] = '';
    });
    if (isProduct) {
      payload.images = images.map(({ _id, imageUrl, imageType, isPrimary, displayOrder, variantId }) => ({ _id, imageUrl, imageType, isPrimary: Boolean(isPrimary), displayOrder: Number(displayOrder || 0), variantId: variantId || null }));
      payload.variants = variants.map(({ _id, variantName, size, color, status }) => ({ _id, variantName, size, color, status }));
    }
    try { await onSave(payload); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal" role="dialog" aria-modal="true" aria-labelledby="wm-modal-title">
      <header><div><span>{mode === 'create' ? 'THÊM MỚI' : mode === 'edit' ? 'CẬP NHẬT' : 'CHI TIẾT'}</span><h2 id="wm-modal-title">{config.title}</h2></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      {readOnly ? <><div className="wm-detail-grid">{config.fields.map(([key, label]) => <div key={key}><small>{label}</small><strong>{key === 'aiTryOn' ? (record?.[key] ? 'Có' : 'Không') : Array.isArray(record?.[key]) ? record[key].map(display).join(', ') : display(record?.[key]) || '—'}</strong></div>)}</div>{isProduct && <><ProductVariantsEditor readOnly variants={variants} productCode={record?.productCode} /><ProductImagesEditor readOnly images={images} /></>}</> : <form className="wm-form" onSubmit={submit}>
        {config.fields.map(([key, label, type, required, optionOrResource, displayKey]) => {
          const multiple = config.multipleFields?.includes(key);
          const fieldRequired = required || (config.service === 'inventoryLocations' && key === 'shopId' && form.type === 'store');
          const selectItems = (type === 'relation' ? choices[optionOrResource] || [] : (optionOrResource || []).map((option) => { const [value, text] = option.split(':'); return { _id: value, [displayKey || 'name']: text }; }))
            .filter((item) => key !== 'parentCategoryId' || item._id !== record?._id)
            .map((item) => {
              const categoryDepth = (category) => {
                let depth = 0; let parent = category?.parentCategoryId; const seen = new Set([String(category?._id)]);
                while (parent) { const id = String(parent?._id || parent); if (seen.has(id)) break; seen.add(id); depth += 1; parent = (choices.categories || []).find((entry) => String(entry._id) === id)?.parentCategoryId; }
                return depth;
              };
              const depth = optionOrResource === 'categories' ? categoryDepth(item) : 0;
              return { value: item._id, label: `${depth ? '　'.repeat(depth) + '↳ ' : ''}${item[displayKey || 'name'] || item.code || item._id}` };
            });
          if (multiple) return <div className="wm-form-field" key={key}><span>{label}</span><MultiSelect options={selectItems} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} placeholder="Select product categories..." /></div>;
          return <label key={key}>{label}{config.service === 'inventoryLocations' && key === 'shopId' && form.type !== 'warehouse' ? ' (bắt buộc với cửa hàng)' : ''}
          {type === 'select' || type === 'relation' ? <select required={fieldRequired} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>
            <option value="">{fieldRequired ? 'Chọn...' : 'Không chọn'}</option>
            {selectItems.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select> : <input required={required} type={type} min={type === 'number' ? '0' : undefined} max={key === 'rating' ? '5' : key === 'discount' ? '100' : undefined} step={type === 'number' ? 'any' : undefined} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
        </label>})}
        {isProduct && <><ProductVariantsEditor variants={variants} onChange={setVariants} productCode={form.productCode} /><ProductImagesEditor images={images} onChange={setImages} variants={variants} productId={record?._id} /></>}
        <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button disabled={saving}>{saving ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : 'Tạo mới'}</button></footer>
      </form>}
      {readOnly && <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>}
    </section>
  </div>;
}

function ProductVariantsEditor({ variants, onChange, productCode, readOnly = false }) {
  const skuPart = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sku = (variant) => [productCode, variant.variantName, variant.color, variant.size].map(skuPart).filter(Boolean).join('-') || 'Nhập thông tin biến thể';
  const update = (index, key, value) => onChange(variants.map((variant, current) => current === index ? { ...variant, [key]: value } : variant));
  return <section className="wm-product-images">
    <div className="wm-inbound-lines-heading"><strong>Biến thể sản phẩm</strong>{!readOnly && <button type="button" className="secondary" onClick={() => onChange([...variants, { variantName: '', size: '', color: '', status: 'active' }])}>+ Thêm biến thể</button>}</div>
    {!variants.length && <small>Chưa có biến thể.</small>}
    {variants.map((variant, index) => <div className="wm-product-image-row wm-variant-row" key={variant._id || `new-${index}`}>
      {readOnly ? <><strong>{variant.variantName || 'Biến thể'}</strong><span>SKU: {variant.sku || sku(variant)}</span><span>Màu: {variant.color || '—'} · Kích thước: {variant.size || '—'}</span></> : <><label>Tên biến thể<input required value={variant.variantName || ''} onChange={(event) => update(index, 'variantName', event.target.value)} /></label>
      <label>Màu<input value={variant.color || ''} onChange={(event) => update(index, 'color', event.target.value)} /></label>
      <label>Kích thước<input value={variant.size || ''} onChange={(event) => update(index, 'size', event.target.value)} /></label>
      <label>SKU tự động<input readOnly value={sku(variant)} /></label>
      <label>Trạng thái<select value={variant.status || 'active'} onChange={(event) => update(index, 'status', event.target.value)}><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label>
      <button type="button" className="danger" onClick={() => onChange(variants.filter((_, current) => current !== index))}>Xóa biến thể</button></>}
    </div>)}
  </section>;
}

function ProductImagesEditor({ images, onChange, variants = [], productId, readOnly = false }) {
  const productVariants = variants.filter((variant) => String(variant.productId?._id || variant.productId) === String(productId));
  const update = (index, field, value) => {
    const targetScope = String(images[index]?.variantId?._id || images[index]?.variantId || 'product');
    onChange(images.map((image, current) => {
      const sameScope = String(image.variantId?._id || image.variantId || 'product') === targetScope;
      if (field === 'isPrimary' && sameScope) return { ...image, isPrimary: current === index };
      return current === index ? { ...image, [field]: value } : image;
    }));
  };
  return <section className="wm-product-images">
    <div className="wm-inbound-lines-heading"><strong>Ảnh sản phẩm</strong>{!readOnly && <button type="button" className="secondary" onClick={() => onChange([...images, { imageUrl: '', imageType: 'GALLERY', isPrimary: images.length === 0, displayOrder: images.length, variantId: null }])}>+ Thêm ảnh</button>}</div>
    {!images.length && <small>Chưa có ảnh sản phẩm.</small>}
    {images.map((image, index) => <div className="wm-product-image-row" key={image._id || index}>
      {image.imageUrl && <img src={image.imageUrl} alt={`Ảnh sản phẩm ${index + 1}`} />}
      {readOnly ? <><span>{image.imageType || 'GALLERY'} · thứ tự {image.displayOrder ?? index}</span>{image.isPrimary && <strong>Ảnh chính</strong>}</> : <>
        <label>URL ảnh<input type="url" required value={image.imageUrl || ''} onChange={(event) => update(index, 'imageUrl', event.target.value)} placeholder="https://..." /></label>
        <label>Loại ảnh<select value={image.imageType || 'GALLERY'} onChange={(event) => update(index, 'imageType', event.target.value)}><option value="MAIN">Ảnh chính</option><option value="GALLERY">Thư viện</option><option value="DETAIL">Chi tiết</option></select></label>
        <label>Áp dụng cho<select value={image.variantId?._id || image.variantId || ''} onChange={(event) => update(index, 'variantId', event.target.value || null)}><option value="">Toàn sản phẩm</option>{productVariants.map((variant) => <option key={variant._id} value={variant._id}>{variant.sku} · {variant.variantName || ''}</option>)}</select></label>
        <label>Thứ tự<input type="number" min="0" step="1" value={image.displayOrder ?? index} onChange={(event) => update(index, 'displayOrder', event.target.value)} /></label>
        <label className="wm-image-primary"><input type="radio" name={`product-primary-image-${image.variantId?._id || image.variantId || 'product'}`} checked={Boolean(image.isPrimary)} onChange={() => update(index, 'isPrimary', true)} /> Ảnh chính</label>
        <button type="button" className="danger" onClick={() => onChange(images.filter((_, current) => current !== index))}>Xóa ảnh</button>
      </>}
    </div>)}
  </section>;
}
