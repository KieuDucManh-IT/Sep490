import React from 'react';
import { Button } from 'react-bootstrap';
import { ProductVariantPicker } from '../../../components/warehouse';
import { codeAndName } from '../shared/slipHelpers';
import { emptyNewItem } from './stocktakeHelpers';

/**
 * Món lạ: món gặp trên kệ mà không có trong danh sách (TASK-016 B2).
 * - Nhập mã: mã có trong hệ thống → thêm dòng cho món đó ở kệ đang kiểm (đang mất → tìm thấy; ở kệ khác → chuyển kệ).
 * - Mã chưa tồn tại (hoặc để trống) → chọn biến thể để tạo món mới lúc duyệt (mã trống = tự sinh).
 * @param {object[]} props.variants biến thể được phép ghi nhận (trong phạm vi phiếu)
 * @param {object[]} props.shelves kệ thuộc kho đang kiểm
 */
export default function StocktakeNewItems({ newItems, setNewItems, variants, shelves }) {
  const updateRow = (index, patch) => setNewItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index) => setNewItems((rows) => rows.filter((_, i) => i !== index));

  return (
    <div className="wm-new-items">
      <strong>Món lạ gặp trên kệ (không có trong danh sách)</strong>
      <small className="wm-stock-subline">Nhập mã trên tem. Chỉ chọn biến thể khi mã chưa có trong hệ thống.</small>
      {newItems.map((item, index) => (
        <div className="wm-new-item-row" key={index}>
          <input value={item.itemCode || ''} onChange={(event) => updateRow(index, { itemCode: event.target.value })}
            placeholder="Mã hàng trên tem" />
          <select aria-label="Kệ đang kiểm" value={item.storageId} onChange={(event) => updateRow(index, { storageId: event.target.value })}>
            <option value="">Kệ đang kiểm</option>
            {shelves.map((storage) => <option key={storage._id} value={storage._id}>{codeAndName(storage)}</option>)}
          </select>
          <ProductVariantPicker
            value={item.variantId}
            variants={variants}
            onChange={(variantId) => updateRow(index, { variantId })}
            placeholder="Biến thể (chỉ khi mã chưa có)"
          />
          <input value={item.serialNumber || ''} onChange={(event) => updateRow(index, { serialNumber: event.target.value })}
            placeholder="Serial (nếu có)" />
          <select aria-label="Kết quả món lạ" value={item.countedResult || 'ok'} onChange={(event) => updateRow(index, { countedResult: event.target.value })}>
            <option value="ok">Dùng được</option>
            <option value="needs_service">Cần xử lý</option>
          </select>
          <Button size="sm" variant="outline-danger" onClick={() => removeRow(index)}>Xóa</Button>
        </div>
      ))}
      <Button size="sm" variant="outline-secondary"
        onClick={() => setNewItems((rows) => [...rows, emptyNewItem(rows[rows.length - 1]?.storageId || '')])}>
        + Thêm món lạ
      </Button>
    </div>
  );
}
