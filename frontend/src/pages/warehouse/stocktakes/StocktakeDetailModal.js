import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';
import WarehouseWorkflowProgress from '../../../components/WarehouseWorkflowProgress';
import { WarehouseCancelledNote } from '../../../components/WarehouseCancelSlipModal';
import { KpiCards, StatusBadge } from '../../../components/warehouse';
import { STOCKTAKE_STATUS_LABELS } from '../../../constants/warehouseLabels';
import { codeAndName, idOf } from '../shared/slipHelpers';
import StocktakeCountTable from './StocktakeCountTable';
import StocktakeNewItems from './StocktakeNewItems';
import { countSummary, scopeLabel, variantsInScope } from './stocktakeHelpers';

const CANCELLABLE_STATUSES = ['draft', 'in_progress', 'counted'];

/** Thẻ số liệu khi đang kiểm: tổng món, cần xử lý, không thấy, khác kệ, món lạ. */
function countingCards(summary) {
  return [
    { key: 'total', label: 'Món trong danh sách', value: summary.total },
    { key: 'needsService', label: 'Cần xử lý', value: summary.needsService, tone: summary.needsService > 0 ? 'warn' : 'default' },
    { key: 'notFound', label: 'Không thấy', value: summary.notFound, tone: summary.notFound > 0 ? 'danger' : 'default' },
    { key: 'moved', label: 'Khác kệ', value: summary.moved },
    { key: 'extra', label: 'Món lạ', value: summary.extra },
  ];
}

/**
 * Thẻ tổng kết sau khi duyệt: đúng / cần xử lý / mất / tìm thấy / chuyển kệ / bị bỏ qua.
 * Các dòng lệch nằm trong phiếu điều chỉnh, chỉ đổi tồn khi phiếu điều chỉnh được duyệt và áp dụng.
 */
function approvedCards(summary) {
  return [
    { key: 'unchanged', label: 'Đúng', value: summary.unchanged },
    { key: 'needsService', label: 'Cần xử lý', value: summary.needsService, tone: summary.needsService > 0 ? 'warn' : 'default' },
    { key: 'lost', label: 'Không thấy', value: summary.lost, tone: summary.lost > 0 ? 'danger' : 'default' },
    { key: 'found', label: 'Món lạ / tìm thấy', value: summary.found },
    { key: 'relocated', label: 'Sai kệ', value: summary.relocated },
    { key: 'skipped', label: 'Bị bỏ qua', value: summary.skipped, tone: summary.skipped > 0 ? 'warn' : 'default' },
  ];
}

function DetailActions({ stocktake, isManager, busy, actions }) {
  const status = stocktake.status;
  return (
    <>
      {isManager && CANCELLABLE_STATUSES.includes(status) && (
        <Button variant="outline-danger" disabled={busy} onClick={actions.onCancel}>Hủy phiếu</Button>
      )}
      {status === 'draft' && isManager && (
        <Button variant="dark" disabled={busy} onClick={actions.onStart}>Bắt đầu kiểm kê</Button>
      )}
      {status === 'in_progress' && (
        <>
          <Button variant="outline-secondary" disabled={busy} onClick={actions.onSave}>Lưu kết quả</Button>
          <Button variant="dark" disabled={busy} onClick={actions.onSubmit}>Gửi kết quả</Button>
        </>
      )}
      {status === 'counted' && isManager && (
        <Button variant="dark" disabled={busy} onClick={actions.onApprove}>Duyệt và tạo điều chỉnh</Button>
      )}
      {status === 'approved' && isManager && (
        <Link className="btn btn-dark" to="/warehousemanager/adjustments">Mở phiếu điều chỉnh</Link>
      )}
    </>
  );
}

/**
 * Chi tiết một phiếu kiểm kê: tiến trình, số liệu tổng, bảng số đếm, hàng mới phát hiện
 * và các nút theo trạng thái / vai trò.
 */
export default function StocktakeDetailModal({
  stocktake, isManager, busy, error, counting, variants, storages, actions, onClose,
}) {
  const lines = stocktake.items || [];
  const editable = stocktake.status === 'in_progress';
  const cards = stocktake.status === 'approved' && stocktake.summary
    ? approvedCards(stocktake.summary)
    : countingCards(countSummary(lines, counting.results));
  const shelves = storages
    .filter((storage) => idOf(storage.locationId) === idOf(stocktake.locationId) && storage.type === 'shelf' && storage.status !== 'inactive')
    .sort((left, right) => String(left.code).localeCompare(String(right.code)));

  return (
    <Modal show onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{stocktake.stocktakeCode} · {codeAndName(stocktake.locationId)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          <StatusBadge status={stocktake.status} labels={STOCKTAKE_STATUS_LABELS} />
          {' '}Phạm vi: {scopeLabel(stocktake)} · Giao cho: {stocktake.assignedStaffId?.FullName || 'Chưa giao'}
        </p>
        <WarehouseWorkflowProgress flow="stocktake" status={stocktake.status} />
        <WarehouseCancelledNote slip={stocktake} />
        {stocktake.selectedLines?.length > 0 && (
          <p className="wm-stock-subline">Phiếu chỉ gồm {stocktake.selectedLines.length} dòng hàng đã chọn khi tạo phiếu.</p>
        )}
        {editable && (
          <p className="wm-stock-subline">
            Mọi món mặc định "Có mặt – dùng được". Chỉ sửa món cần xử lý, không thấy hoặc nằm ở kệ khác; món gặp trên kệ mà không có
            trong danh sách thì thêm ở mục "Món lạ". Duyệt sẽ tạo phiếu điều chỉnh cho các dòng lệch; tồn chỉ đổi khi áp dụng phiếu đó.
          </p>
        )}
        {error && <div className="wm-error">{error}</div>}
        <KpiCards items={cards} />
        <StocktakeCountTable
          lines={lines}
          editable={editable}
          results={counting.results}
          shelves={shelves}
          onResultChange={counting.setResult}
        />
        {editable && (
          <StocktakeNewItems
            newItems={counting.newItems}
            setNewItems={counting.setNewItems}
            variants={variantsInScope(variants, stocktake)}
            shelves={shelves}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
        <DetailActions stocktake={stocktake} isManager={isManager} busy={busy} actions={actions} />
      </Modal.Footer>
    </Modal>
  );
}
