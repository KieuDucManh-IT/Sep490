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

function summaryCards(summary) {
  return [
    { key: 'expected', label: 'Tồn sổ', value: summary.expected },
    { key: 'counted', label: 'Thực tế dự kiến', value: summary.counted },
    { key: 'missing', label: 'Thiếu / mất', value: summary.missing, tone: summary.missing > 0 ? 'danger' : 'default' },
    { key: 'damaged', label: 'Hỏng / không sửa được', value: summary.damaged, tone: summary.damaged > 0 ? 'warn' : 'default' },
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
          <Button variant="outline-secondary" disabled={busy} onClick={actions.onSave}>Lưu số đếm</Button>
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
  const summary = countSummary(lines, counting.counts, counting.itemConditions);
  const storagesOfLocation = storages.filter((storage) => idOf(storage.locationId) === idOf(stocktake.locationId));

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
        {error && <div className="wm-error">{error}</div>}
        <KpiCards items={summaryCards(summary)} />
        <StocktakeCountTable
          lines={lines}
          editable={editable}
          counts={counting.counts}
          itemConditions={counting.itemConditions}
          onCountChange={counting.setCount}
          onConditionChange={counting.setCondition}
        />
        {editable && (
          <StocktakeNewItems
            newItems={counting.newItems}
            setNewItems={counting.setNewItems}
            variants={variantsInScope(variants, stocktake)}
            storages={storagesOfLocation}
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
