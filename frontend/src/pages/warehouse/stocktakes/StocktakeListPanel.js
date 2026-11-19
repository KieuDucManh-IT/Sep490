import React from 'react';
import { Button } from 'react-bootstrap';
import { EmptyState, Pagination, StatusBadge } from '../../../components/warehouse';
import { STOCKTAKE_STATUS_LABELS } from '../../../constants/warehouseLabels';
import SlipListToolbar, { statusOptionsFrom } from '../shared/SlipListToolbar';
import { codeAndName, formatDateTime } from '../shared/slipHelpers';
import { scopeLabel } from './stocktakeHelpers';

const STATUS_OPTIONS = statusOptionsFrom(STOCKTAKE_STATUS_LABELS);

/** Danh sách phiếu kiểm kê, phân trang và lọc phía server (xem usePagedList). */
export default function StocktakeListPanel({ list, onOpen }) {
  const hasFilter = Boolean(list.search || list.status);
  return (
    <section className="wm-panel wm-list-panel">
      <SlipListToolbar
        searchLabel="Tìm mã phiếu, kho hoặc nhân viên"
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        status={list.status}
        onStatusChange={list.setStatus}
        statusOptions={STATUS_OPTIONS}
      />
      <div className="wm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Kho</th>
              <th>Phạm vi</th>
              <th>Nhân viên</th>
              <th>Dòng hàng</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.loading && (
              <tr className="wm-loading-row"><td colSpan="8">Đang tải phiếu kiểm kê...</td></tr>
            )}
            {!list.loading && list.items.map((row) => (
              <tr key={row._id}>
                <td><strong>{row.stocktakeCode}</strong></td>
                <td>{codeAndName(row.locationId)}</td>
                <td>{scopeLabel(row)}</td>
                <td>{row.assignedStaffId?.FullName || 'Chưa giao'}</td>
                <td>{row.lineCount ?? 0}</td>
                <td><StatusBadge status={row.status} labels={STOCKTAKE_STATUS_LABELS} /></td>
                <td>{formatDateTime(row.createdAt)}</td>
                <td>
                  <Button size="sm" variant="outline-secondary" onClick={() => onOpen(row._id)}>Chi tiết</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.loading && !list.items.length && (
        <EmptyState title={hasFilter ? 'Không tìm thấy phiếu khớp bộ lọc.' : 'Chưa có phiếu kiểm kê.'} />
      )}
      <Pagination
        page={list.page}
        limit={list.limit}
        total={list.total}
        onChange={list.setPage}
        onLimitChange={list.setLimit}
        disabled={list.loading}
      />
    </section>
  );
}
