import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import BranchSidebar from '../../../components/BranchSidebar';
import branchReturnService from '../../../services/warehouse/branchReturnService';
import { ConfirmModal, EmptyState, PageHeader, Pagination, StatusBadge } from '../../../components/warehouse';
import { BRANCH_RETURN_STATUS_LABELS } from '../../../constants/warehouseLabels';
import WarehousePageLayout from '../shared/WarehousePageLayout';
import SlipListToolbar, { statusOptionsFrom } from '../shared/SlipListToolbar';
import { codeAndName, formatDateTime } from '../shared/slipHelpers';
import BranchReturnCreateForm from './BranchReturnCreateForm';
import BranchReturnDetailModal from './BranchReturnDetailModal';
import useBranchReturns from './useBranchReturns';
import {
  buildCreatePayload, buildDecisionItems, buildPutawayItems, buildReceiptItems, emptyReturnLine, validateCreateLines,
} from './branchReturnHelpers';
import '../../../styles/ShopDashboard.css';
import '../../../styles/WarehouseManager.css';
import '../../../styles/WarehouseUx.css';

const STATUS_OPTIONS = statusOptionsFrom(BRANCH_RETURN_STATUS_LABELS);

const PAGE_TITLES = {
  branch: 'Trả hàng về kho tổng',
  warehouse: 'Duyệt hàng trả từ chi nhánh',
  staff: 'Nhận hàng trả từ chi nhánh',
};

/** Chi nhánh dùng layout + sidebar chi nhánh; kho tổng dùng layout kho. */
function PageFrame({ isBranch, mode, children }) {
  if (isBranch) {
    return (
      <div className="shop-dashboard-layout">
        <BranchSidebar />
        <main className="shop-main-content wm-stock-control-page">{children}</main>
      </div>
    );
  }
  return (
    <WarehousePageLayout mode={mode === 'warehouse' ? 'manager' : 'staff'} className="wm-stock-control-page">
      {children}
    </WarehousePageLayout>
  );
}

function ReturnListTable({ rows, loading, emptyTitle, onOpen }) {
  return (
    <>
      <div className="wm-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Chi nhánh</th>
              <th>Mặt hàng</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && <tr className="wm-loading-row"><td colSpan="6">Đang tải phiếu trả hàng...</td></tr>}
            {!loading && rows.map((row) => (
              <tr key={row._id}>
                <td><strong>{row.transferCode}</strong></td>
                <td>{codeAndName(row.fromLocationId)}</td>
                <td>{row.lineCount ?? row.items?.length ?? 0} dòng</td>
                <td><StatusBadge status={row.status} labels={BRANCH_RETURN_STATUS_LABELS} fallback={row.status} /></td>
                <td>{formatDateTime(row.createdAt)}</td>
                <td><Button size="sm" variant="outline-secondary" onClick={() => onOpen(row._id)}>Chi tiết</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !rows.length && <EmptyState title={emptyTitle} />}
    </>
  );
}

/**
 * Màn trả hàng chi nhánh → kho tổng, dùng chung cho 3 vai trò:
 * `branch` (quản lý chi nhánh tạo / gửi / hủy phiếu), `warehouse` (chủ kho duyệt),
 * `staff` (nhân viên kho nhận hàng và xếp kệ).
 */
export default function BranchReturnsPage({ mode = 'branch' }) {
  const returns = useBranchReturns(mode);
  const { role, list, selected, form, act } = returns;
  const [showCreate, setShowCreate] = useState(false);
  const [lines, setLines] = useState([emptyReturnLine()]);
  const [confirm, setConfirm] = useState('');

  // Quản lý chi nhánh đổi chi nhánh trên thanh điều hướng: đóng form / phiếu đang mở và tải lại
  // (danh sách đọc chi nhánh đang chọn mỗi lần tải).
  const { setSelected } = returns;
  const reloadList = list.reload;
  useEffect(() => {
    if (!role.isBranch) return undefined;
    const onBranchChanged = () => {
      setShowCreate(false);
      setSelected(null);
      setLines([emptyReturnLine()]);
      reloadList();
    };
    window.addEventListener('vestora_branch_changed', onBranchChanged);
    return () => window.removeEventListener('vestora_branch_changed', onBranchChanged);
  }, [role.isBranch, setSelected, reloadList]);

  const create = async (event) => {
    event.preventDefault();
    const message = validateCreateLines(returns.branchId, lines);
    if (message) {
      returns.setError(message);
      return;
    }
    const payload = buildCreatePayload(returns.branchId, lines);
    const ok = await act(() => branchReturnService.create(payload), 'Đã gửi yêu cầu trả hàng về kho tổng.');
    if (!ok) return;
    setShowCreate(false);
    setLines([emptyReturnLine()]);
  };

  const decideRequest = (decision) => {
    if (decision === 'approve' && !form.assignedStaffId) {
      returns.setError('Chọn nhân viên kho phụ trách nhận hàng.');
      return Promise.resolve(false);
    }
    const payload = { decision, assignedStaffId: form.assignedStaffId, items: buildDecisionItems(selected, form.approval) };
    const message = decision === 'approve'
      ? 'Đã duyệt và khóa số lượng hàng trả tại chi nhánh.'
      : 'Đã từ chối yêu cầu trả hàng.';
    return act(() => branchReturnService.decide(selected._id, payload), message);
  };

  const decideReceipt = (decision, message) => act(
    () => branchReturnService.decideReceipt(selected._id, { decision }),
    message,
  );

  const actions = {
    approveRequest: () => decideRequest('approve'),
    rejectRequest: () => setConfirm('rejectRequest'),
    dispatch: () => act(() => branchReturnService.dispatch(selected._id), 'Đã xác nhận gửi hàng về kho tổng.'),
    cancel: () => setConfirm('cancel'),
    submitReceipt: () => act(
      () => branchReturnService.receive(selected._id, { items: buildReceiptItems(selected, form.receipt) }),
      'Đã gửi kết quả nhận hàng để quản lý kho duyệt.',
    ),
    rejectReceipt: () => decideReceipt('reject', 'Đã yêu cầu kiểm nhận lại.'),
    approveReceipt: () => decideReceipt('approve', 'Đã duyệt kết quả nhận hàng.'),
    submitPutaway: () => act(
      () => branchReturnService.putaway(selected._id, { items: buildPutawayItems(selected, form.allocations) }),
      'Đã xếp hàng trả vào kho tổng.',
    ),
  };

  const runConfirmed = async (action) => {
    await action();
    setConfirm('');
  };

  const toggleCreate = () => {
    setShowCreate((value) => !value);
    setSelected(null);
  };

  const emptyTitle = role.isBranch && !returns.branchId
    ? 'Chưa chọn chi nhánh hiện tại trên thanh điều hướng.'
    : 'Chưa có phiếu trả hàng phù hợp.';
  const pageError = returns.error || list.error || returns.contextError;

  return (
    <PageFrame isBranch={role.isBranch} mode={mode}>
      <PageHeader
        eyebrow={role.isBranch ? 'CHI NHÁNH / ĐIỀU CHUYỂN' : 'KHO TỔNG / HÀNG TRẢ VỀ'}
        title={PAGE_TITLES[mode] || PAGE_TITLES.branch}
        actions={role.isBranch && <Button variant="dark" onClick={toggleCreate}>+ Tạo phiếu trả</Button>}
      />
      {pageError && !selected && <div className="wm-error">{pageError}</div>}
      {returns.notice && <div className="wm-success">{returns.notice}</div>}

      {showCreate && role.isBranch && (
        <BranchReturnCreateForm
          activeBranch={returns.activeBranch}
          branchId={returns.branchId}
          lines={lines}
          setLines={setLines}
          busy={returns.busy}
          onSubmit={create}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <section className="wm-panel wm-list-panel">
        {!role.isBranch && (
          <SlipListToolbar
            searchLabel="Tìm mã phiếu, chi nhánh hoặc nhân viên"
            searchValue={list.searchInput}
            onSearchChange={list.setSearchInput}
            status={list.status}
            onStatusChange={list.setStatus}
            statusOptions={STATUS_OPTIONS}
          />
        )}
        <ReturnListTable rows={list.items} loading={list.loading} emptyTitle={emptyTitle} onOpen={returns.openDetail} />
        {!role.isBranch && (
          <Pagination page={list.page} limit={list.limit} total={list.total} onChange={list.setPage}
            onLimitChange={list.setLimit} disabled={list.loading} />
        )}
      </section>

      {selected && !confirm && (
        <BranchReturnDetailModal
          transfer={selected}
          role={role}
          form={form}
          staff={returns.staff}
          busy={returns.busy}
          error={returns.error}
          actions={actions}
          onClose={() => setSelected(null)}
        />
      )}
      <ConfirmModal
        show={confirm === 'rejectRequest'}
        title={`Từ chối yêu cầu trả ${selected?.transferCode || ''}`}
        body="Chi nhánh sẽ không gửi hàng về kho tổng theo phiếu này."
        confirmText="Từ chối"
        variant="danger"
        onHide={() => setConfirm('')}
        onConfirm={() => runConfirmed(() => decideRequest('reject'))}
      />
      <ConfirmModal
        show={confirm === 'cancel'}
        title={`Hủy phiếu trả ${selected?.transferCode || ''}`}
        body="Phiếu bị hủy và số lượng đang khóa tại chi nhánh được mở lại."
        confirmText="Hủy phiếu"
        variant="danger"
        onHide={() => setConfirm('')}
        onConfirm={() => runConfirmed(() => act(
          () => branchReturnService.cancel(selected._id),
          'Đã hủy phiếu và mở khóa tồn tại chi nhánh.',
        ))}
      />
    </PageFrame>
  );
}
