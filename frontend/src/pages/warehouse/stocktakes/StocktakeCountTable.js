import React from 'react';
import { formatVariantName, labelOf, CONDITION_LABELS } from '../../../constants/warehouseLabels';
import {
  COUNT_CONDITION_OPTIONS, actualQuantity, isIndividualLine, lineCondition, lineVariance,
} from './stocktakeHelpers';

function LineName({ line }) {
  const individual = isIndividualLine(line);
  return (
    <td>
      {formatVariantName(line.variantId)}
      <small className="wm-stock-subline">{individual ? 'Kiểm từng mã hàng' : 'Nhập tổng số lượng'}</small>
      {line.itemId && (
        <small className="wm-stock-subline">
          {line.itemId.itemCode}
          {line.itemId.serialNumber ? ` · ${line.itemId.serialNumber}` : ''}
        </small>
      )}
      {line.countedItemCode && <small className="wm-stock-subline">Mã mới: {line.countedItemCode}</small>}
    </td>
  );
}

function ConditionCell({ line, editable, condition, onConditionChange }) {
  if (!isIndividualLine(line)) return <td>—</td>;
  if (!editable) {
    const saved = line.countedCondition || line.itemId.condition || 'good';
    return <td>{labelOf(CONDITION_LABELS, saved, saved)}</td>;
  }
  return (
    <td>
      <select
        aria-label="Tình trạng thực tế của món hàng"
        value={condition}
        onChange={(event) => onConditionChange(line._id, event.target.value)}
      >
        {COUNT_CONDITION_OPTIONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </td>
  );
}

/**
 * Bảng số đếm của phiếu kiểm kê. Khi phiếu đang kiểm (`editable`), dòng số lượng cho nhập số đếm,
 * dòng kiểm từng món cho chọn tình trạng thực tế.
 */
export default function StocktakeCountTable({ lines, editable, counts, itemConditions, onCountChange, onConditionChange }) {
  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mặt hàng / mã hàng</th>
            <th>Vị trí</th>
            <th>Tồn sổ</th>
            <th>Tình trạng thực tế</th>
            <th>SL thực tế</th>
            <th>Chênh lệch</th>
            <th>Ghi nhận</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const actual = actualQuantity(line, counts, itemConditions);
            const countEditable = editable && !isIndividualLine(line);
            return (
              <tr key={line._id}>
                <LineName line={line} />
                <td>{line.storageId?.code || 'Chưa gán'}</td>
                <td>{line.systemQuantity}</td>
                <ConditionCell
                  line={line}
                  editable={editable}
                  condition={lineCondition(line, itemConditions)}
                  onConditionChange={onConditionChange}
                />
                <td>
                  {countEditable ? (
                    <input
                      className="wm-count-input"
                      type="number"
                      min="0"
                      step="1"
                      value={counts[line._id] ?? ''}
                      onChange={(event) => onCountChange(line._id, event.target.value)}
                    />
                  ) : actual}
                </td>
                <td>{lineVariance(line, actual)}</td>
                <td>{line.isCounted ? line.countedBy?.FullName || 'Đã kiểm' : 'Chưa kiểm'}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr><td colSpan="7">Không có tồn hệ thống trong phạm vi này.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
