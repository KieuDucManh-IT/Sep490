import React, { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import MultiSelect from './MultiSelect';
import { hasChildCategories, productCategoryOptions, selectableParents } from '../utils/categoryTree';
import {
  changeImageColor, colorKey, ensureOnePrimary, imageGroups, moveImageInGroup, setPrimary, sortByDisplayOrder, toImagePayload,
} from '../utils/productImageGroups';
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

let imageKeySeed = 0;
const withKey = (image) => ({ ...image, _key: image._key || image._id || `new-${imageKeySeed += 1}` });

/** Màu của các biến thể chưa xóa của sản phẩm (giữ cách viết của biến thể đầu tiên). */
const variantColors = (variants, productId) => {
  const colors = [];
  variants
    .filter((variant) => String(variant.productId?._id || variant.productId) === String(productId) && !variant.isDeleted)
    .forEach((variant) => {
      const color = String(variant.color || '').trim();
      if (color && !colors.some((item) => colorKey(item) === colorKey(color))) colors.push(color);
    });
  return colors;
};

/** Lựa chọn cho ô select / relation; danh mục: loại cha chỉ là loại cấp 1, sản phẩm chỉ gắn loại cấp cuối. */
const optionsFor = ({ key, type, optionOrResource, displayKey, choices, record, form }) => {
  if (key === 'parentCategoryId') {
    return selectableParents(choices.categories || [], record?._id).map((item) => ({ value: item._id, label: item.name }));
  }
  if (key === 'categoryId' && optionOrResource === 'categories') {
    return productCategoryOptions(choices.categories || [], form.categoryId || []);
  }
  const items = type === 'relation'
    ? choices[optionOrResource] || []
    : (optionOrResource || []).map((option) => { const [value, text] = option.split(':'); return { _id: value, [displayKey || 'name']: text }; });
  return items.map((item) => ({ value: item._id, label: `${item[displayKey || 'name'] || item.code || item._id}` }));
};

export default function WarehouseCrudModal({ config, mode, record, choices, onClose, onSave }) {
  const [form, setForm] = useState(() => getInitialValues(config, record));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState(() => ensureOnePrimary(sortByDisplayOrder(record?.images || []).map(withKey)));
  const readOnly = mode === 'view';
  const isProduct = config.service === 'products';
  const colorOptions = isProduct ? variantColors(choices.variants || [], record?._id) : [];
  const parentLocked = config.service === 'categories' && record?._id && hasChildCategories(choices.categories || [], record._id);

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
    if (isProduct) payload.images = toImagePayload(images, colorOptions);
    try { await onSave(payload); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const renderField = ([key, label, type, required, optionOrResource, displayKey]) => {
    const multiple = config.multipleFields?.includes(key);
    const fieldRequired = required || (config.service === 'inventoryLocations' && key === 'shopId' && form.type === 'store');
    const selectItems = type === 'select' || type === 'relation' ? optionsFor({ key, type, optionOrResource, displayKey, choices, record, form }) : [];
    if (multiple) {
      return <div className="wm-form-field" key={key}><span>{label}</span>
        <MultiSelect options={selectItems} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} placeholder="Chọn loại sản phẩm..." />
        {key === 'categoryId' && <small>Chỉ chọn được loại cấp cuối (loại không có loại con).</small>}
      </div>;
    }
    const locked = key === 'parentCategoryId' && parentLocked;
    return <label key={key}>{label}{config.service === 'inventoryLocations' && key === 'shopId' && form.type !== 'warehouse' ? ' (bắt buộc với cửa hàng)' : ''}
      {type === 'select' || type === 'relation' ? <select required={fieldRequired} disabled={locked} value={form[key]} onChange={(event) => setForm(key === 'type' ? { ...form, type: event.target.value, parentCategoryId: '' } : { ...form, [key]: event.target.value })}>
        <option value="">{fieldRequired ? 'Chọn...' : key === 'parentCategoryId' ? 'Không chọn (loại cấp 1)' : 'Không chọn'}</option>
        {selectItems.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        {locked && form[key] && !selectItems.some((item) => item.value === form[key]) && <option value={form[key]}>{display(record?.[key])}</option>}
      </select> : <input required={required} type={type} min={type === 'number' ? '0' : undefined} max={key === 'rating' ? '5' : key === 'discount' ? '100' : undefined} step={type === 'number' ? 'any' : undefined} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
      {locked && <small>Loại đang có loại con nên không chọn được loại cha (tối đa 2 cấp).</small>}
      {key === 'parentCategoryId' && !locked && <small>Chỉ chọn được loại cấp 1. Bỏ trống để tạo loại cấp 1.</small>}
    </label>;
  };

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal" role="dialog" aria-modal="true" aria-labelledby="wm-modal-title">
      <header><div><span>{mode === 'create' ? 'THÊM MỚI' : mode === 'edit' ? 'CẬP NHẬT' : 'CHI TIẾT'}</span><h2 id="wm-modal-title">{config.title}</h2></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      {readOnly ? <><div className="wm-detail-grid">{config.fields.map(([key, label]) => <div key={key}><small>{label}</small><strong>{key === 'aiTryOn' ? (record?.[key] ? 'Có' : 'Không') : Array.isArray(record?.[key]) ? record[key].map(display).join(', ') : display(record?.[key]) || '—'}</strong></div>)}{isProduct && <div><small>Định giá</small><strong>{record?.isSetPrice === true ? 'Đã mở bán' : 'Chờ Shop Owner định giá'}</strong></div>}</div>{isProduct && <ProductImagesEditor readOnly images={images} colorOptions={colorOptions} />}</> : <form className="wm-form" onSubmit={submit}>
        {config.fields.map(renderField)}
        {isProduct && <ProductImagesEditor images={images} onChange={setImages} colorOptions={colorOptions} />}
        <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button disabled={saving}>{saving ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : 'Tạo mới'}</button></footer>
      </form>}
      {readOnly && <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>}
    </section>
  </div>;
}

const PRIMARY_TOOLTIP = 'Ảnh hiển thị ở danh sách sản phẩm / khi khách chọn màu này';

/**
 * Ảnh sản phẩm theo nhóm (TASK-014 A4): "Ảnh chung" và từng màu biến thể (ảnh dùng cho mọi size của màu đó).
 * Sắp thứ tự bằng ↑ / ↓ trong nhóm; mỗi nhóm đúng một "Ảnh đại diện". Không còn ô "Loại ảnh".
 */
function ProductImagesEditor({ images, onChange, colorOptions = [], readOnly = false }) {
  const groups = imageGroups(images, colorOptions);
  const update = (next) => onChange(ensureOnePrimary(next));
  const indexOf = (image) => images.indexOf(image);
  const addImage = (color) => update([...images, withKey({ imageUrl: '', imageType: 'GALLERY', isPrimary: false, color: color || null })]);
  const setUrl = (index, imageUrl) => onChange(images.map((image, position) => (position === index ? { ...image, imageUrl } : image)));

  return <section className="wm-product-images">
    <div className="wm-inbound-lines-heading"><strong>Ảnh sản phẩm</strong></div>
    {!readOnly && !colorOptions.length && <small>Sản phẩm chưa có biến thể có màu: chỉ thêm được ảnh chung cho toàn sản phẩm.</small>}
    {groups.map((group) => (readOnly && !group.images.length ? null : <div className="wm-product-image-group" key={group.scope}>
      <div className="wm-inbound-lines-heading">
        <span>{group.label} · {group.images.length} ảnh</span>
        {!readOnly && !group.orphan && <button type="button" className="secondary" onClick={() => addImage(group.color)}>+ Thêm ảnh</button>}
      </div>
      {group.orphan && <small className="wm-error">Màu này không còn biến thể — ảnh không hiện cho khách.</small>}
      {!group.images.length && <small>Chưa có ảnh.</small>}
      {group.images.map((image, order) => {
        const index = indexOf(image);
        return <div className="wm-product-image-row" key={image._key || index}>
          {image.imageUrl && <img src={image.imageUrl} alt={`${group.label} ${order + 1}`} />}
          {readOnly ? <><span>Thứ tự {order + 1}</span>{image.isPrimary && <strong title={PRIMARY_TOOLTIP}>Ảnh đại diện</strong>}</> : <>
            <label>URL ảnh<input type="url" required value={image.imageUrl || ''} onChange={(event) => setUrl(index, event.target.value)} placeholder="https://..." /></label>
            <label>Áp dụng cho<select value={image.color || ''} onChange={(event) => update(changeImageColor(images, index, event.target.value))}>
              <option value="">Ảnh chung</option>
              {colorOptions.map((color) => <option key={color} value={color}>Màu: {color}</option>)}
              {group.orphan && <option value={group.color}>Màu: {group.color} (không còn biến thể)</option>}
            </select></label>
            <div className="wm-image-order">
              <button type="button" className="secondary" aria-label="Đưa ảnh lên" disabled={order === 0} onClick={() => onChange(moveImageInGroup(images, index, -1))}><ArrowUp size={14} /></button>
              <button type="button" className="secondary" aria-label="Đưa ảnh xuống" disabled={order === group.images.length - 1} onClick={() => onChange(moveImageInGroup(images, index, 1))}><ArrowDown size={14} /></button>
            </div>
            <label className="wm-image-primary" title={PRIMARY_TOOLTIP}><input type="radio" name={`product-primary-image-${group.scope}`} checked={Boolean(image.isPrimary)} onChange={() => onChange(setPrimary(images, index))} /> Ảnh đại diện</label>
            <button type="button" className="danger" onClick={() => update(images.filter((_, position) => position !== index))}>Xóa ảnh</button>
          </>}
        </div>;
      })}
    </div>))}
    {readOnly && !images.length && <small>Chưa có ảnh sản phẩm.</small>}
  </section>;
}
