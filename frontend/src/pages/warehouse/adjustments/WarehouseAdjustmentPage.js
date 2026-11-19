import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { RefreshCw } from 'lucide-react';
import WarehousePageLayout from '../shared/WarehousePageLayout';
import usePagedList from '../shared/usePagedList';
import SlipListToolbar, { statusOptionsFrom } from '../shared/SlipListToolbar';
import { codeAndName, formatDateTime, isConflict } from '../shared/slipHelpers';
import stockAdjustmentService from '../../../services/warehouse/stockAdjustmentService';
import { ConfirmModal, EmptyState, PageHeader, Pagination, StatusBadge } from '../../../components/warehouse';
import { ADJUSTMENT_STATUS_LABELS } from '../../../constants/warehouseLabels';
import AdjustmentDetailModal, { formatChange } from './AdjustmentDetailModal';

const STATUS_OPTIONS = statusOptionsFrom(ADJUSTMENT_STATUS_LABELS);

/** Màn phiếu điều chỉnh tồn (chủ kho): duyệt phiếu sinh ra từ kiểm kê rồi áp dụng vào tồn. */
export default function WarehouseAdjustmentPage() {
  const fetchPage = useCallback((params) => stockAdjustmentService.list(params), []);
  const list = usePagedList(fetchPage);
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const open = async (id) => {
    setError('');
    try {
      setSelected(await stockAdjustmentService.get(id));
    } catch (openError) {
      setError(openError.message);
    }
  };

  const reloadAfterConflict = async (id) => {
    await list.reload();
    await open(id);
  };

  /** Chạy một thao tác trên phiếu đang mở; thành công hoặc 409 thì tải lại danh sách và phiếu. */
  const runAction = async (action, message) => {
    const id = selected._id;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      await list.reload();
      await open(result?._id || id);
      setNotice(message);
    } catch (actionError) {
      if (isConflict(actionError)) await reloadAfterConflict(id);
      throw actionError;
    } finally {
      setBusy(false);
    }
  };

  const runAndShowError = (action, message) => runAction(action, message).catch((actionError) => {
    setError(actionError.message);
  });

  const approve = () => runAndShowError(
    () => stockAdjustmentService.decide(selected._id, 'approve'),
    'Đã duyệt phiếu.',
  );

  const confirmReject = async (reason) => {
    await runAction(() => stockAdjustmentService.decide(selected._id, 'reject', reason), 'Đã từ chối phiếu.');
    setConfirm('');
  };

  const confirmApply = async () => {
    await runAction(() => stockAdjustmentService.apply(selected._id), 'Đã cập nhật tồn kho.');
    setConfirm('');
  };

  const hasFilter = Boolean(list.search || list.status);
  const shownError = error || list.error;

  return (
    <WarehousePageLayout mode="manager" className="wm-stock-control-page">
      <PageHeader
        eyebrow="KHO TỔNG / KIỂM SOÁT TỒN KHO"
        title="Điều chỉnh tồn"
        description="Duyệt phiếu điều chỉnh sinh ra từ kiểm kê, sau đó áp dụng để cập nhật tồn kho."
        actions={(
          <Button variant="outline-secondary" onClick={list.reload} disabled={list.loading}>
            <RefreshCw size={15} /> Làm mới
          </Button>
        )}
      />
      <div className="wm-stock-tabs">
        <Link to="/warehousemanager/stocktakes">Kiểm kê</Link>
        <Link className="active" to="/warehousemanager/adjustments">Điều chỉnh</Link>
      </div>
      {shownError && <div className="wm-error">{shownError}</div>}
      {notice && <div className="wm-success">{notice}</div>}

      <section className="wm-panel wm-list-panel">
        <SlipListToolbar
          searchLabel="Tìm mã phiếu, kho hoặc người tạo / người duyệt"
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
                <th>Lý do</th>
                <th>Dòng hàng</th>
                <th>Tổng thay đổi</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.loading && (
                <tr className="wm-loading-row"><td colSpan="8">Đang tải phiếu điều chỉnh...</td></tr>
              )}
              {!list.loading && list.items.map((row) => (
                <tr key={row._id}>
                  <td><strong>{row.adjustmentCode}</strong></td>
                  <td>{codeAndName(row.locationId)}</td>
                  <td>{row.reason}</td>
                  <td>{row.lineCount ?? 0}</td>
                  <td>{formatChange(row.totalQuantity)}</td>
                  <td><StatusBadge status={row.status} labels={ADJUSTMENT_STATUS_LABELS} /></td>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>
                    <Button size="sm" variant="outline-secondary" onClick={() => open(row._id)}>Chi tiết</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.loading && !list.items.length && (
          <EmptyState
            title={hasFilter ? 'Không tìm thấy phiếu khớp bộ lọc.' : 'Chưa có phiếu điều chỉnh.'}
            description="Phiếu điều chỉnh được tạo khi chủ kho duyệt một đợt kiểm kê có chênh lệch."
          />
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

      {selected && !confirm && (
        <AdjustmentDetailModal
          adjustment={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onReject={() => setConfirm('reject')}
          onApply={() => setConfirm('apply')}
        />
      )}
      <ConfirmModal
        show={confirm === 'reject'}
        title={`Từ chối phiếu ${selected?.adjustmentCode || ''}`}
        body="Phiếu bị từ chối sẽ không được áp dụng vào tồn kho."
        confirmText="Từ chối phiếu"
        variant="danger"
        reasonMode="optional"
        onHide={() => setConfirm('')}
        onConfirm={confirmReject}
      />
      <ConfirmModal
        show={confirm === 'apply'}
        title={`Áp dụng phiếu ${selected?.adjustmentCode || ''}`}
        body="Tồn kho sẽ được cập nhật theo các dòng của phiếu. Thao tác này không hoàn tác được."
        confirmText="Áp dụng vào tồn kho"
        onHide={() => setConfirm('')}
        onConfirm={confirmApply}
      />
    </WarehousePageLayout>
  );
}
