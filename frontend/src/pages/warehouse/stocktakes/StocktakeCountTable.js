import React, { useState } from 'react';
import { Form } from 'react-bootstrap';
import {
  ITEM_STATUS_LABELS, STOCKTAKE_OUTCOME_LABELS, STOCKTAKE_RESULT_LABELS, formatVariantName, labelOf,
} from '../../../constants/warehouseLabels';
import { idOf } from '../shared/slipHelpers';
import { groupLinesByStorage, isMovedLine, isUnusualLine, lineResult } from './stocktakeHelpers';

function LineName({ line }) {
  return (
    <td>
      <strong>{line.itemId?.itemCode || line.countedItemCode || 'Món mới (mã tự sinh khi duyệt)'}</strong>
      {line.itemId?.serialNumber && <small className="wm-stock-subline">{line.itemId.serialNumber}</small>}
      <small className="wm-stock-subline">{formatVariantName(line.variantId)}</small>
      {line.isExtra && <small className="wm-stock-subline">Món lạ gặp trên kệ</small>}
    </td>
  );
}

/** Ô kết quả: dòng thường 3 lựa chọn; món lạ: dùng được / cần xử lý / bỏ ghi nhận. */
function ResultCell({ line, editable, result, onChange }) {
  if (!editable) return <td>{labelOf(STOCKTAKE_RESULT_LABELS, line.countedResult, line.countedResult ? line.countedResult : 'Chưa kiểm')}</td>;
  return (
    <td>
      <select aria-label="Kết quả kiểm" value={result.countedResult}
        onChange={(event) => onChange(line._id, { ...result, countedResult: event.target.value })}>
        <option value="ok">{STOCKTAKE_RESULT_LABELS.ok}</option>
        <option value="needs_service">{STOCKTAKE_RESULT_LABELS.needs_service}</option>
        <option value="not_found">{line.isExtra ? 'Bỏ ghi nhận' : STOCKTAKE_RESULT_LABELS.not_found}</option>
      </select>
    </td>
  );
}

/** Ô kệ thực tế: mặc định kệ hệ thống; chọn kệ khác khi món có mặt nhưng nằm sai kệ. */
function ShelfCell({ line, editable, result, shelves, onChange }) {
  const systemShelf = idOf(line.storageAtStart || line.storageId);
  if (line.isExtra) return <td>{line.foundStorageId?.code || line.storageId?.code || '—'}</td>;
  if (!editable) {
    const moved = isMovedLine(line, { foundStorageId: idOf(line.foundStorageId) });
    return <td>{moved ? `→ ${line.foundStorageId?.code || ''}` : 'Như hệ thống'}</td>;
  }
  if (result.countedResult === 'not_found') return <td>—</td>;
  return (
    <td>
      <select aria-label="Kệ thực tế" value={result.foundStorageId || systemShelf}
        onChange={(event) => onChange(line._id, { ...result, foundStorageId: event.target.value === systemShelf ? '' : event.target.value })}>
        {!systemShelf && <option value="">Chưa gán kệ</option>}
        {shelves.map((shelf) => (
          <option key={shelf._id} value={idOf(shelf)}>{shelf.code}{idOf(shelf) === systemShelf ? ' (như hệ thống)' : ''}</option>
        ))}
      </select>
    </td>
  );
}

/** Tóm tắt một kệ: "Kệ A-01-03: 12 món · không thấy 1 · khác thường 2". */
function groupSummary(group, results) {
  const notFound = group.lines.filter((line) => !line.isExtra && lineResult(line, results).countedResult === 'not_found').length;
  const unusual = group.lines.filter((line) => isUnusualLine(line, results)).length;
  const parts = [`${group.label}: ${group.lines.length} món`];
  if (notFound) parts.push(`không thấy ${notFound}`);
  if (unusual) parts.push(`khác thường ${unusual}`);
  return parts.join(' · ');
}

/** Kết quả duyệt (đúng / cần xử lý / mất / tìm thấy / chuyển kệ / bị bỏ qua + lý do); dòng lệch đi vào phiếu điều chỉnh. */
function OutcomeCell({ line }) {
  if (!line.appliedOutcome) return <td>{line.isCounted ? line.countedBy?.FullName || 'Đã kiểm' : 'Chưa kiểm'}</td>;
  return (
    <td>
      {labelOf(STOCKTAKE_OUTCOME_LABELS, line.appliedOutcome, line.appliedOutcome)}
      {line.skippedReason && <small className="wm-stock-subline text-danger">{line.skippedReason}</small>}
    </td>
  );
}

/**
 * Bảng kiểm kê theo món, nhóm theo kệ (TASK-016 B2). Khi phiếu đang kiểm (`editable`), mọi món mặc định
 * "Có mặt – dùng được"; người kiểm chỉ sửa món khác thường. Có ô lọc theo mã.
 */
export default function StocktakeCountTable({ lines, editable, results, shelves, onResultChange }) {
  const [query, setQuery] = useState('');
  const [onlyUnusual, setOnlyUnusual] = useState(false);
  const groups = groupLinesByStorage(lines, { query, onlyUnusual, results });

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
              <th>Trạng thái lúc bắt đầu</th>
              <th>Kết quả</th>
              <th>Kệ thực tế</th>
              <th>{lines.some((line) => line.appliedOutcome) ? 'Kết quả duyệt' : 'Ghi nhận'}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.key}>
                <tr className="table-light">
                  <td colSpan="5"><strong>{groupSummary(group, results)}</strong></td>
                </tr>
                {group.lines.map((line) => {
                  const result = lineResult(line, results);
                  return (
                    <tr key={line._id}>
                      <LineName line={line} />
                      <td>{line.statusAtStart ? labelOf(ITEM_STATUS_LABELS, line.statusAtStart, line.statusAtStart) : '—'}</td>
                      <ResultCell line={line} editable={editable} result={result} onChange={onResultChange} />
                      <ShelfCell line={line} editable={editable} result={result} shelves={shelves} onChange={onResultChange} />
                      <OutcomeCell line={line} />
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan="5">{lines.length ? 'Không có món khớp bộ lọc.' : 'Không có món nào trong phạm vi này.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
