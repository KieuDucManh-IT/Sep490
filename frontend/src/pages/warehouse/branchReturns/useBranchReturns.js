import { useCallback, useEffect, useState } from 'react';
import branchReturnService from '../../../services/warehouse/branchReturnService';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import storageLocationService from '../../../services/warehouse/storageLocationService';
import usePagedList from '../shared/usePagedList';
import { idOf } from '../shared/slipHelpers';
import { initialAllocations, initialApproval, initialReceipt } from './branchReturnHelpers';

/**
 * Chi nhánh: giữ hành vi cũ — tải toàn bộ phiếu trả rồi chỉ giữ phiếu của chi nhánh đang chọn.
 * Kho tổng (chủ kho / nhân viên): danh sách phân trang phía server.
 */
function useReturnList(isBranch) {
  const [activeBranch, setActiveBranch] = useState(null);
  const [branchId, setBranchId] = useState('');
  const fetchPage = useCallback(async (params) => {
    if (!isBranch) return branchReturnService.listPage(params);
    const [rows, context] = await Promise.all([branchReturnService.list(), stockTransferService.getBranchContext()]);
    const branch = context.selectedBranch || null;
    setActiveBranch(branch);
    setBranchId(branch?.inventoryLocation ? idOf(branch._id) : '');
    if (!branch?.inventoryLocation) return [];
    return rows.filter((row) => idOf(row.fromLocationId) === idOf(branch.inventoryLocation));
  }, [isBranch]);
  const list = usePagedList(fetchPage);
  return { list, activeBranch, branchId };
}

/** Nhân viên kho (cho chủ kho giao việc) hoặc kệ đang hoạt động (cho nhân viên xếp kệ). */
function useReturnContext(isManager, isStaff) {
  const [context, setContext] = useState({ staff: [], storages: [], error: '' });
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (isManager) return { staff: await branchReturnService.listStaff() };
      if (isStaff) {
        const storages = await storageLocationService.list();
        return { storages: storages.filter((row) => row.status === 'active' && row.type === 'shelf') };
      }
      return {};
    };
    load()
      .then((value) => {
        if (active) setContext((old) => ({ ...old, ...value }));
      })
      .catch((loadError) => {
        if (active) setContext((old) => ({ ...old, error: loadError.message }));
      });
    return () => {
      active = false;
    };
  }, [isManager, isStaff]);
  return context;
}

/** Phiếu đang mở cùng các ô nhập theo bước (số duyệt, kết quả nhận, phân bổ kệ). */
function useSelectedReturn() {
  const [selected, setSelected] = useState(null);
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [approval, setApproval] = useState({});
  const [receipt, setReceipt] = useState({});
  const [allocations, setAllocations] = useState({});

  const open = useCallback(async (id) => {
    const transfer = await branchReturnService.get(id);
    setSelected(transfer);
    setAssignedStaffId(idOf(transfer.assignedStaffId));
    setApproval(initialApproval(transfer));
    setReceipt(initialReceipt(transfer));
    setAllocations(initialAllocations(transfer));
  }, []);

  const form = {
    assignedStaffId,
    setAssignedStaffId,
    approval,
    receipt,
    allocations,
    setApprovalFor: (lineId, value) => setApproval((old) => ({ ...old, [lineId]: value })),
    setReceiptFor: (lineId, value) => setReceipt((old) => ({ ...old, [lineId]: value })),
    setAllocationsFor: (lineId, value) => setAllocations((old) => ({ ...old, [lineId]: value })),
  };
  return { selected, setSelected, open, form };
}

/**
 * Trạng thái và thao tác của màn trả hàng chi nhánh → kho tổng, dùng cho cả 3 vai trò.
 * `act(callback, message)` chạy một thao tác rồi tải lại danh sách và phiếu đang mở;
 * lỗi 409 (phiếu vừa đổi ở nơi khác) cũng tải lại. Trả true nếu thành công.
 * @param {'branch'|'warehouse'|'staff'} mode
 */
export default function useBranchReturns(mode) {
  const isBranch = mode === 'branch';
  const isManager = mode === 'warehouse';
  const isStaff = mode === 'staff';
  const { list, activeBranch, branchId } = useReturnList(isBranch);
  const context = useReturnContext(isManager, isStaff);
  const detail = useSelectedReturn();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const act = async (callback, message) => {
    const currentId = detail.selected?._id;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await callback();
      await list.reload();
      const nextId = updated?._id || currentId;
      if (nextId) await detail.open(nextId);
      setNotice(message);
      return true;
    } catch (actionError) {
      setError(actionError.message);
      if (actionError?.status === 409 && currentId) {
        await list.reload();
        await detail.open(currentId).catch(() => {});
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openDetail = (id) => {
    setError('');
    detail.open(id).catch((openError) => setError(openError.message));
  };

  return {
    role: { isBranch, isManager, isStaff },
    list,
    activeBranch,
    branchId,
    staff: context.staff,
    storages: context.storages,
    contextError: context.error,
    selected: detail.selected,
    setSelected: detail.setSelected,
    form: { ...detail.form, storages: context.storages },
    openDetail,
    act,
    busy,
    error,
    setError,
    notice,
  };
}
