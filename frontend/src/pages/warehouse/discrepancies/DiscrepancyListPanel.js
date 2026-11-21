import React from 'react';
import { Button } from 'react-bootstrap';
import { discrepancyVariantLabel } from '../../../components/StockDiscrepancyDetail';
import { EmptyState, Pagination, StatusBadge } from '../../../components/warehouse';
import {
  DISCREPANCY_STATUS_CLASS, DISCREPANCY_STATUS_LABELS, TRANSFER_DIRECTION_LABELS, labelOf,
} from '../../../constants/warehouseLabels';
import SlipListToolbar from '../shared/SlipListToolbar';
import { codeAndName, formatDateTime } from '../shared/slipHelpers';
import { DISCREPANCY_FILTER_OPTIONS } from './discrepancyHelpers';

/** Danh sách phiếu chênh lệch, phân trang và lọc phía server. */
export default function DiscrepancyListPanel({ list, onOpen }) {
  return (
    <section className="wm-panel wm-list-panel">
      <SlipListToolbar
        searchLabel="Tìm mã phiếu, kho / chi nhánh hoặc người mở"
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        status={list.status}
        onStatusChange={list.setStatus}
        statusOptions={DISCREPANCY_FILTER_OPTIONS}
      />
      <div className="wm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Phiếu điều chuyển gốc</th>
              <th>Chiều</th>
              <th>Nơi gửi → nơi nhận</th>
              <th>Sản phẩm / biến thể</th>
              <th>Thiếu / đã xử lý</th>
              <th>Trạng thái</th>
              <th>Ngày mở</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.loading && (
              <tr className="wm-loading-row"><td colSpan="9">Đang tải phiếu chênh lệch...</td></tr>
            )}
            {!list.loading && list.items.map((row) => (
              <tr key={row._id}>
                <td><strong>{row.discrepancyCode}</strong></td>
                <td>{row.transferId?.transferCode || '—'}</td>
                <td>{labelOf(TRANSFER_DIRECTION_LABELS, row.direction, row.direction)}</td>
                <td>{codeAndName(row.fromLocationId)} → {codeAndName(row.toLocationId)}</td>
                <td>{discrepancyVariantLabel(row) || '—'}</td>
                <td>{row.quantityMissing} / {row.quantityResolved || 0}</td>
                <td>
                  <StatusBadge status={row.status} labels={DISCREPANCY_STATUS_LABELS} classMap={DISCREPANCY_STATUS_CLASS} />
                </td>
                <td>{formatDateTime(row.createdAt)}</td>
                <td>
                  <Button size="sm" variant="outline-secondary" onClick={() => onOpen(row._id)}>Mở phiếu</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.loading && !list.items.length && <EmptyState title="Không có hàng thiếu cần xử lý." />}
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
