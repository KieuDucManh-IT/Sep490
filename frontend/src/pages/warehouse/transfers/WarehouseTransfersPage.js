import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import BranchSidebar from '../../../components/BranchSidebar';
import WarehouseSidebar from '../../../components/WarehouseSidebar';
import WarehouseCancelSlipModal from '../../../components/WarehouseCancelSlipModal';
import { PageHeader } from '../../../components/warehouse';
import useTransfers from './useTransfers';
import TransferListTable from './TransferListTable';
import TransferDetailModal from './TransferDetailModal';
import CreateRequestForm from './CreateRequestForm';
import '../../../styles/ShopDashboard.css';
import '../../../styles/WarehouseManager.css';
import '../../../styles/WarehouseUx.css';
import './transfers.css';

const PAGE_TEXT = {
  warehouse: { eyebrow: 'KHO TỔNG / XUẤT KHO', title: 'Duyệt yêu cầu xuất kho', tab: 'Duyệt yêu cầu', path: '/warehousemanager/outbound' },
  staff: { eyebrow: 'KHO TỔNG / XUẤT KHO', title: 'Soạn và xuất hàng được giao', tab: 'Việc xuất kho được giao', path: '/warehousestaff/outbound' },
  branch: { eyebrow: 'CHI NHÁNH / BỔ SUNG HÀNG', title: 'Yêu cầu bổ sung hàng', tab: 'Yêu cầu bổ sung hàng', path: '/branch/stock-requests' },
};

/**
 * Điều chuyển kho tổng → chi nhánh, dùng chung cho 3 vai trò:
 * - `branch`: chi nhánh tạo yêu cầu bổ sung hàng, nhận hàng (nhiều đợt).
 * - `warehouse`: chủ kho duyệt / từ chối và giao nhân viên.
 * - `staff`: nhân viên kho chọn vị trí lấy hàng, soạn và xuất hàng.
 */
export default function WarehouseTransfersPage({ mode = 'branch' }) {
  const transfers = useTransfers(mode);
  const { isWarehouse, isStaff, selected, context, busy, error, notice, list, query } = transfers;
  const isBranch = !isWarehouse && !isStaff;
  const text = PAGE_TEXT[mode] || PAGE_TEXT.branch;
  const [showCreate, setShowCreate] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const toggleCreate = () => { setShowCreate((value) => !value); transfers.closeTransfer(); };
  const openRow = (id) => {
    setShowCreate(false);
    transfers.clearMessages();
    transfers.openTransfer(id).catch((openError) => transfers.setError(openError.message));
  };
  const confirmCancel = async (reason) => {
    await transfers.cancelTransfer(reason);
    setShowCancel(false);
  };

  const createButton = isBranch && <button className="wm-primary-button" type="button" onClick={toggleCreate}>+ Tạo yêu cầu</button>;

  return <div className="shop-dashboard-layout">
    {isBranch ? <BranchSidebar /> : <WarehouseSidebar mode={isStaff ? 'staff' : 'manager'} />}
    <main className={`shop-main-content ${isBranch ? 'wm-branch-transfer-page' : 'wm-stock-control-page'}`}>
      <PageHeader eyebrow={text.eyebrow} title={text.title} actions={createButton} />
      <div className="wm-stock-tabs">
        <Link className="active" to={text.path}><ArrowLeftRight size={16} />{text.tab}</Link>
      </div>
      {!selected && error && <div className="wm-error">{error}</div>}
      {!selected && notice && <div className="wm-success">{notice}</div>}

      {showCreate && isBranch && <CreateRequestForm
        branchId={context.branchId}
        busy={busy}
        onAction={transfers.runAction}
        onError={transfers.setError}
        onClose={() => setShowCreate(false)}
      />}

      <TransferListTable
        rows={list.items}
        total={list.total}
        query={query}
        searchInput={transfers.searchInput}
        loading={transfers.loading}
        isCentral={!isBranch}
        onSearch={transfers.setSearchInput}
        onStatus={transfers.setStatus}
        onPage={transfers.setPage}
        onLimit={transfers.setLimit}
        onOpen={openRow}
      />

      {selected && <TransferDetailModal
        mode={mode}
        transfer={selected}
        staff={context.staff}
        storages={context.storages}
        busy={busy}
        error={error}
        notice={notice}
        onAction={transfers.runAction}
        onError={transfers.setError}
        onCancel={() => setShowCancel(true)}
        onHide={transfers.closeTransfer}
      />}
      <WarehouseCancelSlipModal
        show={showCancel && Boolean(selected)}
        slipLabel="phiếu điều chuyển"
        slipCode={selected?.transferCode}
        onHide={() => setShowCancel(false)}
        onConfirm={confirmCancel}
      />
    </main>
  </div>;
}
