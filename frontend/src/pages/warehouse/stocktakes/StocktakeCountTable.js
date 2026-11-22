import React, { useState } from 'react';
import { Form } from 'react-bootstrap';
import { formatVariantName, labelOf, CONDITION_LABELS } from '../../../constants/warehouseLabels';
import {
  COUNT_CONDITION_OPTIONS, actualQuantity, groupLinesByStorage, isItemLine, isUnusualLine, lineCondition, lineVariance,
} from './stocktakeHelpers';

function LineName({ line }) {
  return (
    <td>
      <strong>{line.itemId?.itemCode || line.countedItemCode || 'Món lạ (mã tự sinh)'}</strong>
      {line.itemId?.serialNumber && <small className="wm-stock-subline">{line.itemId.serialNumber}</small>}
      <small className="wm-stock-subline">{formatVariantName(line.variantId)}</small>
      {!isItemLine(line) && <small className="wm-stock-subline">Món lạ phát hiện khi kiểm</small>}
    </td>
  );
}

/** Ô tình trạng: mặc định "như cũ"; chỉ đổi món hỏng / thiếu. Món lạ chọn còn ghi nhận hay bỏ. */
function ConditionCell({ line, editable, condition, count, onConditionChange, onCountChange }) {
  if (!isItemLine(line)) {
    const saved = line.countedCondition || 'good';
    if (!editable) return <td>{labelOf(CONDITION_LABELS, saved, saved)}</td>;
    return (
      <td>
        <select aria-label="Ghi nhận món lạ" value={String(count ?? '1')} onChange={(event) => onCountChange(line._id, event.target.value)}>
          <option value="1">Có mặt · {labelOf(CONDITION_LABELS, saved, saved)}</option>
          <option value="0">Bỏ ghi nhận</option>
        </select>
      </td>
    );
  }
  const current = line.itemId?.condition || 'good';
  if (!editable) {
    const saved = line.countedCondition || current;
    return <td>{labelOf(CONDITION_LABELS, saved, saved)}</td>;
  }
  return (
    <td>
      <select aria-label="Tình trạng thực tế của món hàng" value={condition} onChange={(event) => onConditionChange(line._id, event.target.value)}>
        {COUNT_CONDITION_OPTIONS.map(([value, text]) => (
          <option key={value} value={value}>{value === current ? `Có mặt · như cũ (${text})` : text}</option>
        ))}
      </select>
    </td>
  );
}

/** Tóm tắt một kệ: "Kệ A-01-03: 12 món · thiếu 1 · khác thường 2". */
function groupSummary(group, counts, itemConditions) {
  const missing = group.lines.filter((line) => actualQuantity(line, counts, itemConditions) === 0).length;
  const unusual = group.lines.filter((line) => isUnusualLine(line, itemConditions)).length;
  const parts = [`${group.label}: ${group.lines.length} món`];
  if (missing) parts.push(`thiếu ${missing}`);
  if (unusual) parts.push(`khác thường ${unusual}`);
  return parts.join(' · ');
}

/**
 * Bảng kiểm kê theo món, nhóm theo kệ. Khi phiếu đang kiểm (`editable`), mọi món mặc định
 * "có mặt – tình trạng như cũ"; người kiểm chỉ sửa món khác thường. Có ô lọc theo mã.
 */
export default function StocktakeCountTable({
  lines, editable, counts, itemConditions, onCountChange, onConditionChange,
}) {
  const [query, setQuery] = useState('');
  const [onlyUnusual, setOnlyUnusual] = useState(false);
  const groups = groupLinesByStorage(lines, { query, onlyUnusual, itemConditions });

  return (
    <>
      <div className="d-flex gap-3 align-items-center my-2 flex-wrap">
        <Form.Control size="sm" style={{ maxWidth: 280 }} placeholder="Lọc theo mã hàng / SKU..." value={query}
          onChange={(event) => setQuery(event.target.value)} />
        <Form.Check type="switch" id="stocktake-only-unusual" label="Chỉ hiện món khác thường"
          checked={onlyUnusual} onChange={(event) => setOnlyUnusual(event.target.checked)} />
      </div>
      <div className="wm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã hàng / mặt hàng</th>
              <th>Tồn sổ</th>
              <th>Tình trạng thực tế</th>
              <th>Thực tế</th>
              <th>Chênh lệch</th>
              <th>Ghi nhận</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.key}>
                <tr className="table-light">
                  <td colSpan="6"><strong>{groupSummary(group, counts, itemConditions)}</strong></td>
                </tr>
                {group.lines.map((line) => {
                  const actual = actualQuantity(line, counts, itemConditions);
                  return (
                    <tr key={line._id}>
                      <LineName line={line} />
                      <td>{line.systemQuantity}</td>
                      <ConditionCell
                        line={line}
                        editable={editable}
                        condition={lineCondition(line, itemConditions)}
                        count={counts[line._id]}
                        onConditionChange={onConditionChange}
                        onCountChange={onCountChange}
                      />
                      <td>{actual}</td>
                      <td>{lineVariance(line, actual)}</td>
                      <td>{line.isCounted ? line.countedBy?.FullName || 'Đã kiểm' : 'Chưa kiểm'}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan="6">{lines.length ? 'Không có món khớp bộ lọc.' : 'Không có tồn hệ thống trong phạm vi này.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
