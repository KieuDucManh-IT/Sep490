import React, { useCallback, useState } from 'react';
import { Button } from 'react-bootstrap';
import WarehouseCancelSlipModal from '../../../components/WarehouseCancelSlipModal';
import { ConfirmModal, EmptyState, PageHeader, Pagination, StatusBadge } from '../../../components/warehouse';
import { INBOUND_STATUS_LABELS } from '../../../constants/warehouseLabels';
import inboundReceiptService from '../../../services/warehouse/inboundReceiptService';
import WarehousePageLayout from '../shared/WarehousePageLayout';
import usePagedList from '../shared/usePagedList';
import SlipListToolbar, { statusOptionsFrom } from '../shared/SlipListToolbar';
import { codeAndName, isConflict } from '../shared/slipHelpers';
import InboundReceiptModal from './InboundReceiptModal';
import useInboundMasterData from './useInboundMasterData';
import { recountLabel } from './RecountNotice';

const STATUS_OPTIONS = statusOptionsFrom(INBOUND_STATUS_LABELS);

function ReceiptRow({ receipt, onOpen }) {
  return (
    <tr>
      <td><strong>{receipt.receiptCode}</strong></td>
      <td>{codeAndName(receipt.locationId)}</td>
      <td>{receipt.supplierId?.name}</td>
      <td>{receipt.assignedStaffId?.FullName || '—'}</td>
      <td>{receipt.lineCount ?? 0}</td>
      <td>{receipt.totalQuantity ?? 0}</td>
      <td>
        <StatusBadge status={receipt.status} labels={INBOUND_STATUS_LABELS} fallback={receipt.status} />
        {recountLabel(receipt) && <div><small className="text-warning-emphasis">{recountLabel(receipt)}</small></div>}
      </td>
      <td>
        <Button size="sm" variant="outline-secondary" onClick={() => onOpen(receipt._id)}>Mở phiếu</Button>
      </td>
    </tr>
  );
}

/**
 * Màn nhập kho từ nhà cung cấp.
 * Chủ kho: tạo phiếu, duyệt / yêu cầu kiểm nhận lại kết quả tiếp nhận, hủy phiếu.
 * Nhân viên kho: ghi nhận thực nhận, xếp hàng lên kệ (chỉ thấy phiếu được giao).
 */
export default function InboundReceiptsPage({ mode = 'manager' }) {
  const isManager = mode === 'manager';
  const role = isManager ? 'warehouse_manager' : 'warehouse_staff';
  const master = useInboundMasterData(isManager);
  const fetchPage = useCallback((params) => inboundReceiptService.listPage(params), []);
  const list = usePagedList(fetchPage);
  const [selected, setSelected] = useState(null);
  const [modalMode, setModalMode] = useState('');
  const [dialog, setDialog] = useState('');
  const [error, setError] = useState('');

  const closeModal = () => {
    setSelected(null);
    setModalMode('');
    setDialog('');
  };

  /** Danh sách không có chi tiết dòng hàng, nên mở phiếu luôn tải lại đầy đủ qua GET /:id. */
  const openReceipt = async (id) => {
    setError('');
    try {
      setSelected(await inboundReceiptService.get(id));
      setModalMode('view');
    } catch (openError) {
      setError(openError.message);
    }
  };

  const refreshSelected = async (id) => {
    await list.reload();
    const fresh = await inboundReceiptService.get(id).catch(() => null);
    if (fresh) setSelected(fresh);
  };

  /** Gọi API cho phiếu đang mở; 409 = phiếu vừa đổi ở nơi khác → tải lại rồi báo lỗi trong form. */
  const runOnSelected = async (action) => {
    const id = selected._id;
    try {
      await action(id);
      await list.reload();
    } catch (actionError) {
      if (isConflict(actionError)) await refreshSelected(id);
      throw actionError;
    }
  };

  const saveCreate = async (payload) => {
    await inboundReceiptService.create(payload);
    await list.reload();
  };
  const saveReceive = (payload) => runOnSelected((id) => inboundReceiptService.receive(id, payload));
  const savePutaway = (payload) => runOnSelected((id) => inboundReceiptService.putaway(id, payload));

  const approve = async () => {
    try {
      await runOnSelected((id) => inboundReceiptService.approve(id, 'approve', ''));
      closeModal();
    } catch (approveError) {
      setError(approveError.message);
    }
  };

  /** Yêu cầu nhân viên kiểm nhận lại: phiếu về "chờ tiếp nhận", tồn không đổi. Lý do bắt buộc. */
  const confirmRecount = async (reason) => {
    await runOnSelected((id) => inboundReceiptService.approve(id, 'recount', reason));
    closeModal();
  };

  const confirmCancel = async (reason) => {
    const id = selected._id;
    try {
      const updated = await inboundReceiptService.cancel(id, reason);
      setDialog('');
      setError('');
      // Tải lại chi tiết đầy đủ (kèm dòng hàng) để modal hiện trạng thái "Đã hủy".
      const fresh = await inboundReceiptService.get(id).catch(() => null);
      setSelected(fresh || updated);
      await list.reload();
    } catch (cancelError) {
      // Phiếu vừa đổi trạng thái ở nơi khác: tải lại để hiện trạng thái mới, giữ thông báo lỗi trong hộp thoại.
      if (isConflict(cancelError)) await refreshSelected(id);
      throw cancelError;
    }
  };

  const pageError = error || list.error || master.error;
  const hasFilter = Boolean(list.search || list.status);

  return (
    <WarehousePageLayout mode={mode}>
      <PageHeader
        eyebrow="KHO TỔNG / NHẬP KHO"
        title={isManager ? 'Phiếu nhập từ nhà cung cấp' : 'Tiếp nhận & xếp hàng nhập'}
        description={isManager
          ? 'Tạo phiếu, theo dõi tiếp nhận và phê duyệt.'
          : 'Ghi số lượng thực nhận, hàng hỏng và xếp hàng lên kệ.'}
        actions={isManager && (
          <Button variant="dark" onClick={() => { setSelected(null); setModalMode('create'); }}>+ Tạo phiếu nhập</Button>
        )}
      />
      {pageError && <div className="wm-error">{pageError}</div>}
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
                <th>Nhà cung cấp</th>
                <th>Nhân viên</th>
                <th>Dòng hàng</th>
                <th>Dự kiến</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.loading && <tr className="wm-loading-row"><td colSpan={8}>Đang tải phiếu nhập...</td></tr>}
              {!list.loading && list.items.map((receipt) => (
                <ReceiptRow key={receipt._id} receipt={receipt} onOpen={openReceipt} />
              ))}
            </tbody>
          </table>
        </div>
        {!list.loading && !list.items.length && (
          <EmptyState title={hasFilter ? 'Không có phiếu nhập phù hợp.' : 'Chưa có phiếu nhập.'} />
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

      {modalMode && (
        <InboundReceiptModal
          key={`${modalMode}-${selected?._id || 'new'}`}
          mode={modalMode}
          role={role}
          receipt={selected}
          centralLocation={master.centralLocation}
          suppliers={master.suppliers}
          staff={master.staff}
          shelves={master.shelves}
          hidden={Boolean(dialog)}
          error={error}
          onClose={closeModal}
          onCreate={saveCreate}
          onReceive={saveReceive}
          onApprove={approve}
          onRecount={() => setDialog('recount')}
          onPutaway={savePutaway}
          onCancel={isManager ? () => setDialog('cancel') : undefined}
        />
      )}
      <ConfirmModal
        show={dialog === 'recount' && Boolean(selected)}
        title={`Yêu cầu kiểm nhận lại phiếu ${selected?.receiptCode || ''}`}
        body={'Phiếu quay về "Chờ tiếp nhận" để nhân viên được giao đếm lại; số đã nhận được giữ làm giá trị '
          + 'điền sẵn. Tồn kho không thay đổi. Muốn bỏ hẳn lô hàng này thì dùng "Hủy phiếu".'}
        confirmText="Gửi yêu cầu kiểm nhận lại"
        variant="warning"
        reasonMode="required"
        reasonLabel="Lý do kiểm nhận lại (tối đa 500 ký tự)"
        reasonPlaceholder="Ví dụ: số hỏng dòng áo vest M chưa khớp biên bản giao hàng"
        onHide={() => setDialog('')}
        onConfirm={confirmRecount}
      />
      <WarehouseCancelSlipModal
        show={dialog === 'cancel' && Boolean(selected)}
        slipLabel="phiếu nhập"
        slipCode={selected?.receiptCode}
        onHide={() => setDialog('')}
        onConfirm={confirmCancel}
      />
    </WarehousePageLayout>
  );
}
