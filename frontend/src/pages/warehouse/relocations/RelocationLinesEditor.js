import React from 'react';
import { Button } from 'react-bootstrap';
import { codeAndName } from '../shared/slipHelpers';
import { addTargetLine, applyTargetToVariant } from './relocationHelpers';

/**
 * Bảng dòng di chuyển: Biến thể · Từ kệ · Đến kệ · Số lượng.
 * "+ Kệ đích khác" thêm dòng cùng nguồn (tách); "Dùng kệ đích này cho mọi kệ nguồn" điền cùng đích cho
 * các dòng cùng biến thể (gộp). Cả hai chỉ là cách điền dòng.
 */
export default function RelocationLinesEditor({ lines, setLines, shelves }) {
  const update = (index, patch) => setLines((old) => old.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const remove = (index) => setLines((old) => old.filter((_, i) => i !== index));
  const sameVariantCount = (line) => lines.filter((other) => other.variantId === line.variantId).length;

  if (!lines.length) {
    return <p className="wm-stock-subline">Chưa có dòng nào. Bấm “Thêm hàng từ kệ nguồn” để chọn hàng đang nằm trên kệ.</p>;
  }

  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Biến thể</th>
            <th>Từ kệ</th>
            <th>Đến kệ</th>
            <th>Số lượng</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.key}>
              <td>
                {line.label}
                <small className="wm-stock-subline">Khả dụng ở kệ nguồn: {line.available}</small>
              </td>
              <td>{line.fromLabel || '—'}</td>
              <td>
                <select
                  required
                  aria-label="Kệ đích"
                  value={line.toStorageId}
                  onChange={(event) => update(index, { toStorageId: event.target.value })}
                >
                  <option value="">Chọn kệ đích</option>
                  {shelves.filter((shelf) => shelf._id !== line.fromStorageId).map((shelf) => (
                    <option key={shelf._id} value={shelf._id}>{codeAndName(shelf)}</option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  max={line.available}
                  aria-label="Số lượng"
                  value={line.quantity}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                />
              </td>
              <td className="wm-relocation-line-actions">
                <Button size="sm" variant="outline-secondary" onClick={() => setLines((old) => addTargetLine(old, index))}>
                  + Kệ đích khác
                </Button>
                {sameVariantCount(line) > 1 && line.toStorageId && (
                  <Button size="sm" variant="outline-secondary" onClick={() => setLines((old) => applyTargetToVariant(old, index))}>
                    Dùng kệ đích này cho mọi kệ nguồn
                  </Button>
                )}
                <Button size="sm" variant="outline-danger" onClick={() => remove(index)}>Xóa</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
