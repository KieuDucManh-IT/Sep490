import { useCallback, useEffect, useState } from 'react';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import storageLocationService from '../../../services/warehouse/storageLocationService';
import { idOf } from './transferHelpers';

const SEARCH_DELAY_MS = 350;

/**
 * Trạng thái và thao tác của trang điều chuyển kho tổng → chi nhánh.
 * - Danh sách phân trang phía server: đổi trang / trạng thái / từ khóa đều gọi lại API.
 * - `runAction(callback, message)`: chạy một thao tác trên phiếu, rồi tải lại danh sách và phiếu đang mở.
 *   Lỗi 409 (phiếu vừa đổi trạng thái ở nơi khác) cũng tải lại để hiện trạng thái mới.
 * @param {'branch'|'warehouse'|'staff'} mode
 */
export default function useTransfers(mode) {
  const isWarehouse = mode === 'warehouse';
  const isStaff = mode === 'staff';
  const [list, setList] = useState({ items: [], total: 0 });
  const [query, setQuery] = useState({ page: 1, limit: 10, status: '', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(null);
  const [context, setContext] = useState({ storages: [], staff: [], branchId: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await stockTransferService.listPage(query);
      const lastPage = Math.max(1, Math.ceil(result.total / query.limit));
      // Trang hiện tại không còn phiếu (vd vừa hủy phiếu cuối trang): lùi về trang cuối.
      if (query.page > lastPage) { setQuery((old) => ({ ...old, page: lastPage })); return; }
      setList({ items: result.items, total: result.total });
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  // Dữ liệu phụ theo vai trò: kệ (nhân viên soạn hàng), nhân viên kho (chủ kho duyệt), chi nhánh đang thao tác (BM).
  useEffect(() => {
    let active = true;
    const loadContext = async () => {
      if (isStaff) {
        const storages = await storageLocationService.list();
        return { storages: storages.filter((storage) => storage.status === 'active') };
      }
      if (isWarehouse) return { staff: await stockTransferService.listStaff() };
      const branch = await stockTransferService.getBranchContext();
      return { branchId: branch.selectedBranch?.inventoryLocation ? idOf(branch.selectedBranch._id) : '' };
    };
    loadContext()
      .then((value) => { if (active) setContext((old) => ({ ...old, ...value })); })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [isWarehouse, isStaff]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((old) => (old.search === searchInput ? old : { ...old, search: searchInput, page: 1 }));
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setPage = (page) => setQuery((old) => ({ ...old, page }));
  const setLimit = (limit) => setQuery((old) => ({ ...old, limit, page: 1 }));
  const setStatus = (status) => setQuery((old) => ({ ...old, status, page: 1 }));

  const openTransfer = async (id) => {
    if (!id) return;
    setSelected(await stockTransferService.get(id));
  };
  const closeTransfer = () => setSelected(null);
  const clearMessages = () => { setError(''); setNotice(''); };

  const reloadAll = async (id) => {
    await load();
    await openTransfer(id).catch((refreshError) => setError(refreshError.message));
  };

  /** Chạy một thao tác; trả về true nếu thành công. */
  const runAction = async (callback, message) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await callback();
      await reloadAll(result?._id || selected?._id);
      setNotice(message);
      return true;
    } catch (actionError) {
      setError(actionError.message);
      if (actionError.status === 409) await reloadAll(selected?._id);
      return false;
    } finally { setBusy(false); }
  };

  /** Dùng cho WarehouseCancelSlipModal: lỗi ném ra để modal hiện, 409 thì tải lại trước. */
  const cancelTransfer = async (reason) => {
    const id = selected._id;
    try {
      await stockTransferService.cancel(id, reason);
    } catch (cancelError) {
      if (cancelError.status === 409) await reloadAll(id);
      throw cancelError;
    }
    setError('');
    await reloadAll(id);
    setNotice('Đã hủy phiếu điều chuyển.');
  };

  return {
    isWarehouse, isStaff, list, query, searchInput, setSearchInput, setPage, setLimit, setStatus,
    selected, openTransfer, closeTransfer, clearMessages, context, loading, busy, error, setError, notice,
    runAction, cancelTransfer,
  };
}
