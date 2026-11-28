import React from 'react';
import { EmptyState, Pagination, StatusBadge } from '../../../components/warehouse';
import { TRANSFER_STATUS_LABELS } from '../../../constants/warehouseLabels';
import { locationName } from './transferHelpers';

const LIMIT_OPTIONS = [10, 20, 50];

/**
 * Danh sách phiếu điều chuyển (một trang lấy từ server) kèm ô tìm, lọc trạng thái và phân trang.
 * Mọi thay đổi bộ lọc / trang đều báo lên để trang gọi lại API.
 */
export default function TransferListTable({ rows, total, query, searchInput, loading, isCentral, onSearch, onStatus, onPage, onLimit, onOpen }) {
  return <section className="wm-panel wm-list-panel">
    <div className="wm-list-toolbar">
      <label className="wm-search-field">Tìm mã phiếu, chi nhánh hoặc người phụ trách
        <input value={searchInput} onChange={(event) => onSearch(event.target.value)} placeholder="Nhập từ khóa..." />
      </label>
      <label>Trạng thái
        <select value={query.status} onChange={(event) => onStatus(event.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(TRANSFER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    <div className="wm-table-wrap"><table>
      <thead><tr><th>Mã phiếu</th><th>{isCentral ? 'Chi nhánh yêu cầu' : 'Kho tổng'}</th><th>Mặt hàng</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead>
      <tbody>
        {loading && <tr className="wm-loading-row"><td colSpan="6">Đang tải phiếu điều chuyển...</td></tr>}
        {!loading && !rows.length && <tr><td colSpan="6">
          <EmptyState title="Chưa có yêu cầu điều chuyển" description={query.status || query.search ? 'Không có phiếu khớp bộ lọc.' : undefined} />
        </td></tr>}
        {!loading && rows.map((row) => <tr key={row._id}>
          <td><strong>{row.transferCode}</strong><small className="wm-row-summary">{row.createdBy?.FullName || 'Người tạo chưa rõ'}</small></td>
          <td>{locationName(isCentral ? row.toLocationId : row.fromLocationId)}</td>
          <td>{row.lineCount || 0} dòng<small className="wm-row-summary">Tổng {row.totalQuantity || 0} sản phẩm</small></td>
          <td><StatusBadge status={row.status} labels={TRANSFER_STATUS_LABELS} fallback={row.status} />
            {row.hasDiscrepancy && <small className="wm-row-summary text-danger">Có chênh lệch</small>}</td>
          <td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td>
          <td><button type="button" className="secondary" onClick={() => onOpen(row._id)}>Mở phiếu</button></td>
        </tr>)}
      </tbody>
    </table></div>
    <Pagination page={query.page} limit={query.limit} total={total} limitOptions={LIMIT_OPTIONS} disabled={loading} onChange={onPage} onLimitChange={onLimit} />
  </section>;
}
