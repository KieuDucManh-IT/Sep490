import React, { useRef, useState } from 'react';
import { ProductVariantPicker } from '../../../components/warehouse';
import stockTransferService from '../../../services/warehouse/stockTransferService';

/**
 * Form chi nhánh gửi yêu cầu bổ sung hàng lên kho tổng.
 * Mỗi dòng tìm thẳng biến thể theo tên / mã sản phẩm / SKU (không phải chọn sản phẩm trước).
 */
export default function CreateRequestForm({ branchId, busy, onAction, onError, onClose }) {
  const nextKey = useRef(1);
  const newLine = () => ({ key: nextKey.current++, variantId: '', quantityRequested: 1 });
  const [lines, setLines] = useState(() => [newLine()]);

  const updateLine = (key, changes) => setLines((old) => old.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  const removeLine = (key) => setLines((old) => old.filter((line) => line.key !== key));
  const chosenIds = lines.map((line) => line.variantId).filter(Boolean);

  const submit = async (event) => {
    event.preventDefault();
    const validLines = lines.filter((line) => line.variantId && Number.isInteger(Number(line.quantityRequested)) && Number(line.quantityRequested) > 0);
    if (!branchId || validLines.length !== lines.length) {
      onError('Hãy chọn đầy đủ biến thể và nhập số lượng nguyên lớn hơn 0 cho từng dòng.');
      return;
    }
    const variantIds = validLines.map((line) => line.variantId);
    if (new Set(variantIds).size !== variantIds.length) { onError('Mỗi biến thể chỉ nên xuất hiện một lần trong yêu cầu.'); return; }
    const items = validLines.map(({ variantId, quantityRequested }) => ({ variantId, quantityRequested }));
    const ok = await onAction(() => stockTransferService.createRequest({ branchId, items }), 'Đã gửi yêu cầu bổ sung đến kho tổng.');
    if (ok) { setLines([newLine()]); onClose(); }
  };

  return <form className="wm-panel wm-form wm-stock-create" onSubmit={submit}>
    <div className="wm-transfer-request-lines">
      <div className="wm-transfer-request-heading">
        <strong>Mặt hàng cần bổ sung</strong>
        <small>Chi nhánh hiện tại: {branchId ? 'Hàng được yêu cầu từ kho tổng về đây' : 'Chưa xác định kho cửa hàng'}</small>
      </div>
      {lines.map((line) => <div className="wm-transfer-request-item" key={line.key}>
        <label htmlFor={`transfer-variant-${line.key}`}>Sản phẩm / biến thể</label>
        <ProductVariantPicker
          id={`transfer-variant-${line.key}`}
          value={line.variantId}
          excludeIds={chosenIds}
          onChange={(variantId) => updateLine(line.key, { variantId: variantId || '' })}
          placeholder="Gõ tên sản phẩm, mã sản phẩm hoặc SKU..."
        />
        <div className="wm-transfer-request-quantity">
          <label>Số lượng cần bổ sung
            <input required type="number" min="1" step="1" aria-label="Số lượng yêu cầu" value={line.quantityRequested}
              onChange={(event) => updateLine(line.key, { quantityRequested: event.target.value })} />
          </label>
          <button type="button" className="danger" disabled={lines.length === 1} onClick={() => removeLine(line.key)}>Xóa dòng</button>
        </div>
      </div>)}
      <button className="secondary" type="button" onClick={() => setLines((old) => [...old, newLine()])}>+ Thêm mặt hàng</button>
    </div>
    <footer>
      <button className="secondary" type="button" onClick={onClose}>Hủy</button>
      <button type="submit" disabled={busy || !branchId}>Gửi yêu cầu</button>
    </footer>
  </form>;
}
