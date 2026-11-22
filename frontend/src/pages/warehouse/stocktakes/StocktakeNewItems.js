import React from 'react';
import { Button } from 'react-bootstrap';
import { ProductVariantPicker } from '../../../components/warehouse';
import { codeAndName } from '../shared/slipHelpers';
import { NEW_ITEM_CONDITION_OPTIONS, emptyNewItem } from './stocktakeHelpers';

function ItemFields({ item, onChange }) {
  return (
    <>
      <input
        value={item.itemCode || ''}
        onChange={(event) => onChange({ itemCode: event.target.value })}
        placeholder="Mã hàng (trống = tự sinh)"
      />
      <input
        value={item.serialNumber || ''}
        onChange={(event) => onChange({ serialNumber: event.target.value })}
        placeholder="Serial (nếu có)"
      />
      <select
        aria-label="Tình trạng món hàng mới"
        value={item.countedCondition || 'good'}
        onChange={(event) => onChange({ countedCondition: event.target.value })}
      >
        {NEW_ITEM_CONDITION_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </>
  );
}

/**
 * Ghi nhận hàng có thực tế trong kho nhưng chưa có trên hệ thống.
 * Mỗi dòng là một món; mã hàng không bắt buộc (để trống thì hệ thống tự sinh khi áp dụng điều chỉnh).
 * @param {object[]} props.variants biến thể được phép ghi nhận (trong phạm vi phiếu)
 * @param {object[]} props.storages vị trí thuộc kho đang kiểm
 */
export default function StocktakeNewItems({ newItems, setNewItems, variants, storages }) {
  const updateRow = (index, patch) => setNewItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index) => setNewItems((rows) => rows.filter((_, i) => i !== index));

  return (
    <div className="wm-new-items">
      <strong>Ghi nhận món thực tế chưa có trong hệ thống (món lạ)</strong>
      {newItems.map((item, index) => {
        return (
          <div className="wm-new-item-row" key={index}>
            <ProductVariantPicker
              value={item.variantId}
              variants={variants}
              onChange={(variantId) => updateRow(index, { variantId })}
              placeholder="Chọn biến thể (tìm theo tên hoặc SKU)"
            />
            <select value={item.storageId} onChange={(event) => updateRow(index, { storageId: event.target.value })}>
              <option value="">Vị trí</option>
              {storages.map((storage) => (
                <option key={storage._id} value={storage._id}>{codeAndName(storage)}</option>
              ))}
            </select>
            <ItemFields item={item} onChange={(patch) => updateRow(index, patch)} />
            <Button size="sm" variant="outline-danger" onClick={() => removeRow(index)}>Xóa</Button>
          </div>
        );
      })}
      <Button size="sm" variant="outline-secondary" onClick={() => setNewItems((rows) => [...rows, emptyNewItem()])}>
        + Thêm món lạ
      </Button>
    </div>
  );
}
