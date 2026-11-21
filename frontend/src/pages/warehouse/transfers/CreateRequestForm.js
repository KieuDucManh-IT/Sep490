import React, { useCallback, useRef, useState } from 'react';
import { VariantQuantityPicker, mergeQuantityLines } from '../../../components/warehouse';
import { formatVariantName } from '../../../constants/warehouseLabels';
import inventoryReportService from '../../../services/warehouse/inventoryReportService';
import stockTransferService from '../../../services/warehouse/stockTransferService';

/**
 * Form chi nhánh gửi yêu cầu bổ sung hàng lên kho tổng.
 * Chọn sản phẩm một lần rồi nhập số lượng cho nhiều biến thể (VariantQuantityPicker, TASK-014 B);
 * cột "Tồn chi nhánh" chỉ để tham khảo, không chặn. Biến thể đã có trong yêu cầu được cộng dồn.
 * Payload gửi lên giữ nguyên: `{ branchId, items: [{ variantId, quantityRequested }] }`.
 */
export default function CreateRequestForm({ branchId, busy, onAction, onError, onClose }) {
  const nextKey = useRef(1);
  const [lines, setLines] = useState([]);

  const updateLine = (key, changes) => setLines((old) => old.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  const removeLine = (key) => setLines((old) => old.filter((line) => line.key !== key));
  const addPicked = (picked) => setLines((old) => mergeQuantityLines(old, picked, {
    quantityKey: 'quantityRequested',
    createLine: (pick) => ({ key: nextKey.current++, variantId: pick.variantId, variant: pick.variant, quantityRequested: pick.quantity }),
  }));
  const branchStock = useCallback(
    (variantIds) => inventoryReportService.getBranchAvailability({ branchId, variantIds }),
    [branchId],
  );

  const submit = async (event) => {
    event.preventDefault();
    const validLines = lines.filter((line) => line.variantId && Number.isInteger(Number(line.quantityRequested)) && Number(line.quantityRequested) > 0);
    if (!branchId || !lines.length || validLines.length !== lines.length) {
      onError('Hãy chọn đầy đủ biến thể và nhập số lượng nguyên lớn hơn 0 cho từng dòng.');
      return;
    }
    const variantIds = validLines.map((line) => line.variantId);
    if (new Set(variantIds).size !== variantIds.length) { onError('Mỗi biến thể chỉ nên xuất hiện một lần trong yêu cầu.'); return; }
    const items = validLines.map(({ variantId, quantityRequested }) => ({ variantId, quantityRequested }));
    const ok = await onAction(() => stockTransferService.createRequest({ branchId, items }), 'Đã gửi yêu cầu bổ sung đến kho tổng.');
    if (ok) { setLines([]); onClose(); }
  };

  return <form className="wm-panel wm-form wm-stock-create" onSubmit={submit}>
    <div className="wm-transfer-request-lines">
      <div className="wm-transfer-request-heading">
        <strong>Mặt hàng cần bổ sung</strong>
        <small>Chi nhánh hiện tại: {branchId ? 'Hàng được yêu cầu từ kho tổng về đây' : 'Chưa xác định kho cửa hàng'}</small>
      </div>
      <VariantQuantityPicker
        onAdd={addPicked}
        existingLines={lines.map((line) => ({ variantId: line.variantId, quantity: line.quantityRequested }))}
        stockResolver={branchId ? branchStock : undefined}
        stockLabel="Tồn chi nhánh"
        disabled={!branchId}
      />
      {!lines.length && <small>Chưa có mặt hàng. Chọn sản phẩm, nhập số lượng từng biến thể rồi bấm "Thêm vào phiếu".</small>}
      {lines.map((line) => <div className="wm-transfer-request-item" key={line.key}>
        <span>Sản phẩm / biến thể</span>
        <strong>{formatVariantName(line.variant) || line.variantId}</strong>
        <div className="wm-transfer-request-quantity">
          <label>Số lượng cần bổ sung
            <input required type="number" min="1" step="1" aria-label="Số lượng yêu cầu" value={line.quantityRequested}
              onChange={(event) => updateLine(line.key, { quantityRequested: event.target.value })} />
          </label>
          <button type="button" className="danger" onClick={() => removeLine(line.key)}>Xóa dòng</button>
        </div>
      </div>)}
    </div>
    <footer>
      <button className="secondary" type="button" onClick={onClose}>Hủy</button>
      <button type="submit" disabled={busy || !branchId || !lines.length}>Gửi yêu cầu</button>
    </footer>
  </form>;
}
