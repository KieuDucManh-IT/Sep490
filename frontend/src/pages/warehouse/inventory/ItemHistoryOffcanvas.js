import React, { useEffect, useState } from 'react';
import { Offcanvas, Tab, Tabs } from 'react-bootstrap';
import { EmptyState, Pagination } from '../../../components/warehouse';
import inventoryInsightService from '../../../services/warehouse/inventoryInsightService';
import {
  DISPOSAL_METHOD_LABELS, DISPOSAL_STATUS_LABELS, ITEM_STATUS_LABELS, MAINTENANCE_RESULT_LABELS,
  MAINTENANCE_STATUS_LABELS, MAINTENANCE_TYPE_LABELS, MOVEMENT_TYPE_LABELS, formatVariantName, labelOf,
} from '../../../constants/warehouseLabels';
import { formatDateTime } from '../shared/slipHelpers';

const PAGE_LIMIT = 10;

const placeText = (place) => {
  if (!place) return '—';
  const location = place.location?.code || place.location?.name || '';
  const storage = place.storage?.code || '';
  return [location, storage || (place.location ? 'không có kệ' : '')].filter(Boolean).join(' · ') || '—';
};

/** Tải một trang của một tab; đổi trang / tab thì gọi lại API. */
function useHistoryTab(itemId, tab, active) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: false, error: '', data: null });
  useEffect(() => {
    if (!active || !itemId) return undefined;
    let alive = true;
    setState((old) => ({ ...old, loading: true, error: '' }));
    inventoryInsightService.getItemHistory(itemId, { tab, page, limit: PAGE_LIMIT })
      .then((data) => alive && setState({ loading: false, error: '', data }))
      .catch((error) => alive && setState({ loading: false, error: error.message, data: null }));
    return () => {
      alive = false;
    };
  }, [itemId, tab, page, active]);
  return { ...state, page, setPage };
}

function MovementTable({ entries }) {
  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr><th>Thời gian</th><th>Loại</th><th>Từ → Đến</th><th>Phiếu</th><th>Người thực hiện</th></tr>
        </thead>
        <tbody>
          {entries.map((row) => (
            <tr key={row.movementIds.join('-')}>
              <td>{formatDateTime(row.createdAt)}</td>
              <td>
                {labelOf(MOVEMENT_TYPE_LABELS, row.movementType, 'Khác')}
                {row.note && <small className="wm-stock-subline">{row.note}</small>}
              </td>
              <td>{placeText(row.from)} → {placeText(row.to)}</td>
              <td>{row.referenceCode || '—'}</td>
              <td>{row.createdBy?.FullName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function maintenanceRow(row) {
  if (row.kind === 'disposal') {
    return {
      type: 'Thanh lý',
      description: `${labelOf(DISPOSAL_METHOD_LABELS, row.method, row.method)} · ${row.reason || ''}`,
      status: labelOf(DISPOSAL_STATUS_LABELS, row.status, row.status),
      person: row.decidedBy?.FullName || row.requestedBy?.FullName || '—',
    };
  }
  const result = row.repairResult ? ` · ${labelOf(MAINTENANCE_RESULT_LABELS, row.repairResult, row.repairResult)}` : '';
  return {
    type: labelOf(MAINTENANCE_TYPE_LABELS, row.maintenanceType, row.maintenanceType),
    description: [row.issueDescription, row.repairDescription].filter(Boolean).join(' — '),
    status: `${labelOf(MAINTENANCE_STATUS_LABELS, row.status, row.status)}${result}`,
    person: row.assignedTo?.FullName || row.reportedBy?.FullName || '—',
  };
}

function MaintenanceTable({ entries }) {
  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr><th>Ngày</th><th>Loại</th><th>Mô tả</th><th>Trạng thái</th><th>Người làm</th></tr>
        </thead>
        <tbody>
          {entries.map((row) => {
            const view = maintenanceRow(row);
            return (
              <tr key={`${row.kind}-${row._id}`}>
                <td>{formatDateTime(row.date)}</td>
                <td>{view.type}</td>
                <td>{view.description || '—'}</td>
                <td>{view.status}</td>
                <td>{view.person}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TabBody({ tabState, emptyTitle, children, footnote }) {
  if (tabState.error) return <div className="wm-error">{tabState.error}</div>;
  if (tabState.loading && !tabState.data) return <div className="wm-tree-empty">Đang tải lịch sử...</div>;
  const data = tabState.data;
  if (!data) return null;
  return (
    <>
      {footnote}
      {data.entries.length ? children(data.entries) : <EmptyState title={emptyTitle} />}
      <Pagination page={tabState.page} limit={PAGE_LIMIT} total={data.total} onChange={tabState.setPage} disabled={tabState.loading} />
    </>
  );
}

/**
 * Ngăn bên phải: chi tiết một mã hàng (một món) + 2 tab lịch sử (di chuyển, giặt / sửa / thanh lý).
 * Lịch sử di chuyển chỉ có từ khi hệ thống ghi sổ theo mã hàng; dữ liệu cũ không suy ngược.
 */
export default function ItemHistoryOffcanvas({ itemId, onHide }) {
  const [tab, setTab] = useState('movements');
  const movements = useHistoryTab(itemId, 'movements', tab === 'movements');
  const maintenance = useHistoryTab(itemId, 'maintenance', tab === 'maintenance');
  const item = movements.data?.item || maintenance.data?.item;
  const movementData = movements.data;

  const incompleteNote = movementData?.incomplete && (
    <p className="wm-stock-subline">
      Lịch sử được ghi từ {movementData.earliestAt ? formatDateTime(movementData.earliestAt) : 'ngày triển khai tính năng'};
      {' '}các di chuyển trước đó của mã hàng này chưa được ghi lại.
    </p>
  );

  return (
    <Offcanvas show={Boolean(itemId)} onHide={onHide} placement="end" className="wm-item-history">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title as="h5">{item?.itemCode || 'Mã hàng'}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {item && (
          <dl className="wm-item-history-info">
            <dt>Biến thể</dt><dd>{formatVariantName(item.variantId) || '—'}</dd>
            <dt>Serial</dt><dd>{item.serialNumber || '—'}</dd>
            <dt>Trạng thái</dt><dd>{labelOf(ITEM_STATUS_LABELS, item.status, item.status)}</dd>
            {item.soldOrder?.orderCode && <><dt>Đơn bán</dt><dd>{item.soldOrder.orderCode}</dd></>}
            <dt>Vị trí hiện tại</dt><dd>{placeText({ location: item.locationId, storage: item.storageId })}</dd>
          </dl>
        )}
        <Tabs activeKey={tab} onSelect={(key) => setTab(key || 'movements')} className="mb-3">
          <Tab eventKey="movements" title="Lịch sử di chuyển">
            <TabBody tabState={movements} emptyTitle="Chưa có lịch sử di chuyển được ghi." footnote={incompleteNote}>
              {(entries) => <MovementTable entries={entries} />}
            </TabBody>
          </Tab>
          <Tab eventKey="maintenance" title="Lịch sử giặt/sửa">
            <TabBody tabState={maintenance} emptyTitle="Mã hàng chưa từng giặt / sửa / thanh lý.">
              {(entries) => <MaintenanceTable entries={entries} />}
            </TabBody>
          </Tab>
        </Tabs>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
