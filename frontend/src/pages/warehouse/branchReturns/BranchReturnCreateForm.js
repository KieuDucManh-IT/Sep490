import React from 'react';
import { ProductVariantPicker } from '../../../components/warehouse';
import { emptyReturnLine } from './branchReturnHelpers';

/**
 * Form chi nhánh tạo yêu cầu trả hàng về kho tổng. Chi nhánh gửi lấy theo chi nhánh đang chọn
 * trên thanh điều hướng; mỗi dòng chọn thẳng biến thể bằng ô tìm theo tên hoặc SKU.
 */
export default function BranchReturnCreateForm({ activeBranch, branchId, lines, setLines, busy, onSubmit, onCancel }) {
  const updateLine = (index, patch) => setLines((old) => old.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeLine = (index) => setLines((old) => old.filter((_, i) => i !== index));
  const addLine = () => setLines((old) => [...old, emptyReturnLine()]);

  return (
    <form className="wm-panel wm-form wm-stock-create" onSubmit={onSubmit}>
      <div className="wm-branch-lock">
        <small>Chi nhánh gửi hàng</small>
        <strong>{activeBranch?.name || 'Chưa chọn chi nhánh hiện tại'}</strong>
        <span>Hàng sẽ được gửi về kho tổng. Chi nhánh nguồn lấy theo chi nhánh đang chọn trên hệ thống.</span>
      </div>
      <div className="wm-transfer-request-lines">
        <div className="wm-transfer-request-heading">
          <strong>Mặt hàng cần trả</strong>
          <small>Tìm sản phẩm theo tên hoặc SKU, chọn biến thể và số lượng muốn gửi về kho tổng.</small>
        </div>
        {lines.map((line, index) => {
          const otherIds = lines.filter((_, i) => i !== index).map((row) => row.variantId).filter(Boolean);
          return (
            <div className="wm-transfer-request-item" key={index}>
              <label>
                Sản phẩm / biến thể
                <ProductVariantPicker
                  value={line.variantId}
                  excludeIds={otherIds}
                  onChange={(variantId) => updateLine(index, { variantId })}
                />
              </label>
              <div className="wm-transfer-request-quantity">
                <label>
                  Số lượng trả
                  <input aria-label="Số lượng trả" required type="number" min="1" step="1" value={line.quantityRequested}
                    onChange={(event) => updateLine(index, { quantityRequested: event.target.value })} />
                </label>
                <button className="danger" type="button" disabled={lines.length === 1} onClick={() => removeLine(index)}>
                  Xóa dòng
                </button>
              </div>
            </div>
          );
        })}
        <button type="button" className="secondary" onClick={addLine}>+ Thêm mặt hàng</button>
      </div>
      <footer>
        <button type="button" className="secondary" onClick={onCancel}>Hủy</button>
        <button type="submit" disabled={busy || !branchId}>Gửi yêu cầu</button>
      </footer>
    </form>
  );
}
