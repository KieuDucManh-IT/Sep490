import React, { useCallback, useState } from 'react';
import { VariantQuantityPicker, linesOverStock, mergeQuantityLines } from '../../../components/warehouse';
import { formatVariantName } from '../../../constants/warehouseLabels';
import inventoryReportService from '../../../services/warehouse/inventoryReportService';

const idOf = (value) => String(value?._id || value || '');

/**
 * Form chi nhánh tạo yêu cầu trả hàng về kho tổng. Chi nhánh gửi lấy theo chi nhánh đang chọn
 * trên thanh điều hướng. Chọn sản phẩm một lần rồi nhập số lượng nhiều biến thể (VariantQuantityPicker,
 * TASK-014 B), không cho vượt "Khả dụng tại chi nhánh". Hàng theo mã (individual) chỉ nhập số lượng ở đây;
 * mã hàng cụ thể vẫn do hệ thống giữ ở bước duyệt như trước. Payload tạo phiếu giữ nguyên.
 */
export default function BranchReturnCreateForm({ activeBranch, branchId, lines, setLines, busy, onSubmit, onCancel }) {
  const [stock, setStock] = useState(() => new Map());
  const [error, setError] = useState('');
  const filledLines = lines.filter((line) => idOf(line.variantId));

  const updateLine = (variantId, patch) => setLines((old) => old.map((row) => (idOf(row.variantId) === variantId ? { ...row, ...patch } : row)));
  const removeLine = (variantId) => setLines((old) => old.filter((row) => idOf(row.variantId) !== variantId));
  const addPicked = (picked) => setLines((old) => mergeQuantityLines(old, picked, {
    quantityKey: 'quantityRequested',
    createLine: (pick) => ({ variantId: pick.variantId, variant: pick.variant, quantityRequested: pick.quantity }),
  }));

  // Đọc khả dụng một lần cho cả bảng của picker; giữ lại để chặn khi sửa số lượng ở dòng phiếu.
  const branchStock = useCallback(async (variantIds) => {
    const map = await inventoryReportService.getBranchAvailability({ branchId, variantIds });
    setStock((old) => new Map([...old, ...map]));
    return map;
  }, [branchId]);

  const over = linesOverStock(filledLines, stock, 'quantityRequested');
  const overById = new Map(over.map((row) => [row.variantId, row.stock]));

  const submit = (event) => {
    if (!filledLines.length) {
      event.preventDefault();
      setError('Hãy thêm ít nhất một mặt hàng cần trả.');
      return;
    }
    if (over.length) {
      event.preventDefault();
      setError('Có dòng vượt số lượng khả dụng tại chi nhánh.');
      return;
    }
    setError('');
    if (filledLines.length !== lines.length) setLines(filledLines);
    onSubmit(event);
  };

  return (
    <form className="wm-panel wm-form wm-stock-create" onSubmit={submit}>
      <div className="wm-branch-lock">
        <small>Chi nhánh gửi hàng</small>
        <strong>{activeBranch?.name || 'Chưa chọn chi nhánh hiện tại'}</strong>
        <span>Hàng sẽ được gửi về kho tổng. Chi nhánh nguồn lấy theo chi nhánh đang chọn trên hệ thống.</span>
      </div>
      <div className="wm-transfer-request-lines">
        <div className="wm-transfer-request-heading">
          <strong>Mặt hàng cần trả</strong>
          <small>Chọn sản phẩm, nhập số lượng từng biến thể (không vượt khả dụng tại chi nhánh) rồi bấm "Thêm vào phiếu".</small>
        </div>
        {error && <div className="wm-error">{error}</div>}
        <VariantQuantityPicker
          onAdd={addPicked}
          existingLines={filledLines.map((line) => ({ variantId: line.variantId, quantity: line.quantityRequested }))}
          stockResolver={branchId ? branchStock : undefined}
          stockLabel="Khả dụng tại chi nhánh"
          maxByStock
          disabled={!branchId}
        />
        {!filledLines.length && <small>Chưa có mặt hàng.</small>}
        {filledLines.map((line) => {
          const id = idOf(line.variantId);
          const max = stock.get(id);
          return (
            <div className="wm-transfer-request-item" key={id}>
              <span>Sản phẩm / biến thể</span>
              <strong>{formatVariantName(line.variant || line.variantId) || id}</strong>
              <div className="wm-transfer-request-quantity">
                <label>
                  Số lượng trả{max != null ? ` (khả dụng ${max})` : ''}
                  <input aria-label="Số lượng trả" required type="number" min="1" step="1" max={max ?? undefined}
                    value={line.quantityRequested}
                    onChange={(event) => updateLine(id, { quantityRequested: event.target.value })} />
                  {overById.has(id) && <small className="text-danger">Vượt khả dụng tại chi nhánh ({overById.get(id)}).</small>}
                </label>
                <button className="danger" type="button" onClick={() => removeLine(id)}>Xóa dòng</button>
              </div>
            </div>
          );
        })}
      </div>
      <footer>
        <button type="button" className="secondary" onClick={onCancel}>Hủy</button>
        <button type="submit" disabled={busy || !branchId || !filledLines.length || over.length > 0}>Gửi yêu cầu</button>
      </footer>
    </form>
  );
}
