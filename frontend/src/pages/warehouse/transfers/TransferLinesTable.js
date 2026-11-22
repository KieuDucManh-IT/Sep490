import React from 'react';
import { StockDiscrepancyBadge } from '../../../components/StockDiscrepancyDetail';
import { ItemCodeGroup } from '../../../components/warehouse';
import { itemCodeOf, lineName } from './transferHelpers';

/**
 * Bảng các dòng hàng của một phiếu điều chuyển. Mỗi panel thay cột cần nhập liệu qua render prop.
 * @param {object} props
 * @param {object} props.transfer phiếu đầy đủ (GET /:id)
 * @param {(line: object) => React.ReactNode} [props.renderApproved] ô "Được duyệt"
 * @param {(line: object) => React.ReactNode} [props.renderReceived] ô "Đã nhận"
 * @param {string} [props.receivedHeader] tiêu đề cột nhận
 * @param {{ header: string, render: (line: object) => React.ReactNode }} [props.extraColumn] cột thêm ở cuối
 * @param {string} [props.className]
 * @param {(line: object) => string} [props.rowClassName] class thêm cho từng dòng (vd tô đỏ dòng thiếu hàng)
 */
export default function TransferLinesTable({
  transfer, renderApproved, renderReceived, receivedHeader = 'Đã nhận', extraColumn, className = '', rowClassName,
}) {
  const damagedHeader = transfer.status === 'received' ? 'Hỏng / thiếu' : 'Hỏng';
  return <div className="wm-table-wrap"><table className={className}>
    <thead><tr>
      <th>Sản phẩm / SKU</th><th>Yêu cầu</th><th>Được duyệt</th><th>Đã xuất</th><th>{receivedHeader}</th><th>{damagedHeader}</th>
      {extraColumn && <th>{extraColumn.header}</th>}
    </tr></thead>
    <tbody>{(transfer.items || []).map((line) => <tr key={line._id} className={rowClassName?.(line) || undefined}>
      <td>
        {lineName(line)}
        {line.itemIds?.length > 0 && <ItemCodeGroup label="Mã hàng đã xuất" items={line.itemIds} codeOf={itemCodeOf} />}
      </td>
      <td>{line.quantityRequested}</td>
      <td>{renderApproved ? renderApproved(line) : line.quantityApproved ?? '—'}</td>
      <td>{line.quantityShipped || 0}</td>
      <td>{renderReceived ? renderReceived(line) : line.quantityReceived || 0}</td>
      <td>
        {line.quantityDamaged || 0}{line.quantityMissing > 0 ? ` / thiếu ${line.quantityMissing}` : ''}
        {line.discrepancyId && <div><StockDiscrepancyBadge discrepancy={line.discrepancyId} quantityMissing={line.quantityMissing} /></div>}
      </td>
      {extraColumn && <td>{extraColumn.render(line)}</td>}
    </tr>)}</tbody>
  </table></div>;
}
