import React, { useState } from 'react';
import { X } from 'lucide-react';
import MultiSelect from './MultiSelect';
import '../styles/WarehouseManager.css';

const getInitialValues = (config, record) => Object.fromEntries(config.fields.map(([key]) => {
  const value = record?.[key];
  const normalized = config.multipleFields?.includes(key)
    ? (Array.isArray(value) ? value.map((item) => item?._id || item).filter(Boolean) : value ? [value?._id || value] : [])
    : Array.isArray(value) ? (value[0]?._id || value[0] || '') : (value?._id || value || '');
  const initial = normalized === '' && config.defaults?.[key] !== undefined ? config.defaults[key] : normalized;
  return [key, key === 'aiTryOn' && initial !== '' ? String(initial) : initial];
}));
const display = (value) => value && typeof value === 'object' ? value.FullName || value.name || value.code || value._id : value ?? '—';

export default function WarehouseCrudModal({ config, mode, record, choices, onClose, onSave }) {
  const [form, setForm] = useState(() => getInitialValues(config, record));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState(() => (record?.images || []).map((image) => ({ ...image })));
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
      payload.images = images.map(({ _id, imageUrl, imageType, isPrimary, displayOrder, color }) => ({ _id, imageUrl, imageType, isPrimary: Boolean(isPrimary), displayOrder: Number(displayOrder || 0), color: color || null }));
    }
    try { await onSave(payload); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal" role="dialog" aria-modal="true" aria-labelledby="wm-modal-title">
      <header><div><span>{mode === 'create' ? 'THÊM MỚI' : mode === 'edit' ? 'CẬP NHẬT' : 'CHI TIẾT'}</span><h2 id="wm-modal-title">{config.title}</h2></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      {readOnly ? <><div className="wm-detail-grid">{config.fields.map(([key, label]) => <div key={key}><small>{label}</small><strong>{key === 'aiTryOn' ? (record?.[key] ? 'Có' : 'Không') : Array.isArray(record?.[key]) ? record[key].map(display).join(', ') : display(record?.[key]) || '—'}</strong></div>)}{isProduct && <div><small>Định giá</small><strong>{record?.isSetPrice === true ? 'Đã mở bán' : 'Chờ Shop Owner định giá'}</strong></div>}</div>{isProduct && <ProductImagesEditor readOnly images={images} variants={choices.variants || []} productId={record?._id} />}</> : <form className="wm-form" onSubmit={submit}>
        {config.fields.map(([key, label, type, required, optionOrResource, displayKey]) => {
          const multiple = config.multipleFields?.includes(key);
          const fieldRequired = required || (config.service === 'inventoryLocations' && key === 'shopId' && form.type === 'store');
          const parentType = form.type === 'lv2' ? 'lv1' : form.type === 'lv3' ? 'lv2' : null;
          const selectItems = (type === 'relation' ? choices[optionOrResource] || [] : (optionOrResource || []).map((option) => { const [value, text] = option.split(':'); return { _id: value, [displayKey || 'name']: text }; }))
            .filter((item) => key !== 'parentCategoryId' || (item._id !== record?._id && (!parentType || item.type === parentType)))
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
          {type === 'select' || type === 'relation' ? <select required={fieldRequired} disabled={key === 'parentCategoryId' && form.type === 'lv1'} value={form[key]} onChange={(event) => setForm(key === 'type' ? { ...form, type: event.target.value, parentCategoryId: '' } : { ...form, [key]: event.target.value })}>
            <option value="">{fieldRequired ? 'Chọn...' : 'Không chọn'}</option>
            {selectItems.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select> : <input required={required} type={type} min={type === 'number' ? '0' : undefined} max={key === 'rating' ? '5' : key === 'discount' ? '100' : undefined} step={type === 'number' ? 'any' : undefined} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
        </label>})}
        {isProduct && <ProductImagesEditor images={images} onChange={setImages} variants={choices.variants || []} productId={record?._id} />}
        <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button disabled={saving}>{saving ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : 'Tạo mới'}</button></footer>
      </form>}
      {readOnly && <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>}
    </section>
  </div>;
}

const colorKey = (value) => String(value || '').trim().toLowerCase();
const imageScope = (image) => colorKey(image?.color) || '__product__';

// Ảnh gắn theo màu (TASK-007): "Toàn sản phẩm" (color null) hoặc "Màu: <tên>" dùng cho mọi size của màu đó.
function ProductImagesEditor({ images, onChange, variants = [], productId, readOnly = false }) {
  const productVariants = variants.filter((variant) => String(variant.productId?._id || variant.productId) === String(productId) && !variant.isDeleted);
  const colorOptions = [];
  productVariants.forEach((variant) => {
    const color = String(variant.color || '').trim();
    if (color && !colorOptions.some((item) => colorKey(item) === colorKey(color))) colorOptions.push(color);
  });
  const hasVariantColor = (color) => colorOptions.some((item) => colorKey(item) === colorKey(color));
  const orphanColors = [...new Set(images.map((image) => String(image.color || '').trim()).filter((color) => color && !hasVariantColor(color)))];
  const update = (index, field, value) => {
    if (field === 'isPrimary') {
      const targetScope = imageScope(images[index]);
      onChange(images.map((image, current) => (imageScope(image) === targetScope ? { ...image, isPrimary: current === index } : image)));
      return;
    }
    if (field === 'color') {
      const color = value || null;
      // Đổi phạm vi: nếu phạm vi mới đã có ảnh chính thì ảnh này không còn là ảnh chính.
      const nextScope = colorKey(color) || '__product__';
      const scopeHasPrimary = images.some((image, current) => current !== index && image.isPrimary && imageScope(image) === nextScope);
      onChange(images.map((image, current) => (current === index ? { ...image, color, isPrimary: image.isPrimary && !scopeHasPrimary } : image)));
      return;
    }
    onChange(images.map((image, current) => (current === index ? { ...image, [field]: value } : image)));
  };
  const scopeLabel = (image) => (image.color ? `Màu: ${image.color}` : 'Toàn sản phẩm');
  return <section className="wm-product-images">
    <div className="wm-inbound-lines-heading"><strong>Ảnh sản phẩm</strong>{!readOnly && <button type="button" className="secondary" onClick={() => onChange([...images, { imageUrl: '', imageType: 'GALLERY', isPrimary: !images.some((image) => image.isPrimary && !image.color), displayOrder: images.length, color: null }])}>+ Thêm ảnh</button>}</div>
    {!images.length && <small>Chưa có ảnh sản phẩm.</small>}
    {!readOnly && !colorOptions.length && <small>Sản phẩm chưa có biến thể có màu: chỉ thêm được ảnh dùng chung cho toàn sản phẩm.</small>}
    {images.map((image, index) => {
      const orphan = Boolean(image.color) && !hasVariantColor(image.color);
      return <div className="wm-product-image-row" key={image._id || index}>
        {image.imageUrl && <img src={image.imageUrl} alt={`Ảnh sản phẩm ${index + 1}`} />}
        {readOnly ? <><span>{scopeLabel(image)} · {image.imageType || 'GALLERY'} · thứ tự {image.displayOrder ?? index}</span>{image.isPrimary && <strong>Ảnh chính</strong>}</> : <>
          <label>URL ảnh<input type="url" required value={image.imageUrl || ''} onChange={(event) => update(index, 'imageUrl', event.target.value)} placeholder="https://..." /></label>
          <label>Loại ảnh<select value={image.imageType || 'GALLERY'} onChange={(event) => update(index, 'imageType', event.target.value)}><option value="MAIN">Ảnh chính</option><option value="GALLERY">Thư viện</option><option value="DETAIL">Chi tiết</option></select></label>
          <label>Áp dụng cho<select value={image.color || ''} onChange={(event) => update(index, 'color', event.target.value)}>
            <option value="">Toàn sản phẩm</option>
            {colorOptions.map((color) => <option key={color} value={color}>Màu: {color}</option>)}
            {orphanColors.map((color) => <option key={`orphan-${color}`} value={color}>Màu: {color} (không còn biến thể)</option>)}
          </select></label>
          <label>Thứ tự<input type="number" min="0" step="1" value={image.displayOrder ?? index} onChange={(event) => update(index, 'displayOrder', event.target.value)} /></label>
          <label className="wm-image-primary"><input type="radio" name={`product-primary-image-${imageScope(image)}`} checked={Boolean(image.isPrimary)} onChange={() => update(index, 'isPrimary', true)} /> Ảnh chính{image.color ? ` (màu ${image.color})` : ' (chung)'}</label>
          <button type="button" className="danger" onClick={() => onChange(images.filter((_, current) => current !== index))}>Xóa ảnh</button>
        </>}
        {orphan && <small className="wm-error">Màu này không còn biến thể — ảnh không hiện cho khách.</small>}
      </div>;
    })}
  </section>;
}
