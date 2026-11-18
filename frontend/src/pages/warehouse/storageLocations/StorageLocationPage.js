import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import StorageLocationCrudModal from '../../../components/StorageLocationCrudModal';
import { ConfirmModal, EmptyState, PageHeader, Pagination } from '../../../components/warehouse';
import { STORAGE_TYPE_LABELS, labelOf } from '../../../constants/warehouseLabels';
import inventoryLocationService from '../../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../../services/warehouse/storageLocationService';
import WarehousePageLayout from '../shared/WarehousePageLayout';
import StorageTree from './StorageTree';
import { idOf } from './storageHelpers';

/** Lọc cây vị trí theo từ khóa (mã / tên) và trạng thái; vị trí gốc là khu hoặc khu tạm. */
function useStorageTree(rows, warehouse, filters) {
  const [expanded, setExpanded] = useState({});
  const { query, statusFilter } = filters;

  const childrenOf = useCallback((parentId, type) => rows
    .filter((row) => idOf(row.parentStorageId) === parentId && (!type || row.type === type)), [rows]);

  const matches = useCallback((row) => {
    const keyword = query.toLowerCase();
    const queryMatches = !keyword || [row.code, row.name].some((value) => String(value || '').toLowerCase().includes(keyword));
    return queryMatches && (!statusFilter || row.status === statusFilter);
  }, [query, statusFilter]);

  const visibleRowsForZone = useCallback((zone) => childrenOf(zone._id, 'row')
    .map((row) => ({ row, shelves: childrenOf(row._id, 'shelf').filter(matches) }))
    .filter(({ row, shelves }) => matches(row) || shelves.length > 0), [childrenOf, matches]);

  const visibleRoots = useMemo(() => rows
    .filter((row) => !idOf(row.parentStorageId) && ['zone', 'temporary_area'].includes(row.type))
    .filter((root) => {
      if (matches(root)) return true;
      return root.type === 'zone' && visibleRowsForZone(root).length > 0;
    }), [rows, matches, visibleRowsForZone]);

  // Khu mới tải về mặc định mở rộng; khu đã có giữ trạng thái người dùng chọn.
  useEffect(() => {
    setExpanded((previous) => Object.fromEntries(rows
      .filter((row) => row.type === 'zone')
      .map((row) => [row._id, previous[row._id] ?? true])));
  }, [rows]);

  const toggle = (id) => setExpanded((old) => ({ ...old, [id]: !(old[id] ?? true) }));
  const locationName = () => warehouse?.name || '';

  return { rows, expanded, toggle, childrenOf, matches, visibleRowsForZone, visibleRoots, locationName };
}

function Toolbar({ filters, setFilters }) {
  const set = (key) => (event) => setFilters((old) => ({ ...old, [key]: event.target.value }));
  return (
    <div className="wm-list-toolbar">
      <label className="wm-search-field">
        Tìm kiếm
        <input value={filters.query} onChange={set('query')} placeholder="Tìm theo mã hoặc tên..." />
      </label>
      <label>
        Trạng thái
        <select value={filters.statusFilter} onChange={set('statusFilter')}>
          <option value="">Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Ngừng hoạt động</option>
        </select>
      </label>
    </div>
  );
}

/**
 * Danh mục vị trí lưu trữ: phân cấp Khu → Dãy → Kệ (và khu tạm); sức chứa tính theo cái.
 * Danh sách là danh mục nhỏ tải một lần, nên lọc / phân trang theo khu ngay trên trình duyệt.
 * Chỉ hiện vị trí của kho tổng (TASK-014 A2): không chọn / lọc theo kho.
 */
export default function StorageLocationPage() {
  const [warehouse, setWarehouse] = useState(null);
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [filters, setFilters] = useState({ query: '', statusFilter: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const tree = useStorageTree(rows, warehouse, filters);

  const load = useCallback(async () => {
    setError('');
    try {
      const [central, storageData] = await Promise.all([inventoryLocationService.central(), storageLocationService.list()]);
      setWarehouse(central);
      setRows(storageData.filter((row) => idOf(row.locationId) === idOf(central?._id)));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  const pageRoots = tree.visibleRoots.slice((page - 1) * pageSize, page * pageSize);

  const save = async (payload) => {
    if (modal.mode === 'edit') await storageLocationService.update(modal.record._id, payload);
    else await storageLocationService.create(payload);
    await load();
  };

  const confirmRemove = async () => {
    await storageLocationService.remove(removing._id);
    setRemoving(null);
    await load();
  };

  const actions = {
    onCreateChild: (parent) => setModal({ mode: 'create', record: null, parent }),
    onView: (record) => setModal({ mode: 'view', record, parent: null }),
    onEdit: (record) => setModal({ mode: 'edit', record, parent: null }),
    onRemove: setRemoving,
  };

  return (
    <WarehousePageLayout>
      <PageHeader
        eyebrow="KHO TỔNG / DANH MỤC DÙNG CHUNG"
        title="Vị trí lưu trữ"
        description={`Kho: ${warehouse?.name || 'kho tổng'} · Phân cấp Khu → Dãy → Kệ; sức chứa tính theo cái.`}
        actions={<Button variant="dark" disabled={!warehouse} onClick={() => setModal({ mode: 'create', record: null, parent: null })}>+ Thêm khu</Button>}
      />
      {error && <div className="wm-error">{error}</div>}
      <section className="wm-panel wm-list-panel">
        <Toolbar filters={filters} setFilters={setFilters} />
        {loading && <div className="wm-tree-empty">Đang tải vị trí lưu trữ...</div>}
        {!loading && pageRoots.map((root) => <StorageTree key={root._id} root={root} tree={tree} actions={actions} />)}
        {!loading && !pageRoots.length && <EmptyState title="Không có vị trí phù hợp." />}
        <Pagination page={page} limit={pageSize} total={tree.visibleRoots.length} onChange={setPage}
          onLimitChange={setPageSize} limitOptions={[10, 20, 50]} />
      </section>
      {!loading && !warehouse && <div className="wm-error">Chưa cấu hình kho tổng đang hoạt động.</div>}
      {modal && (
        <StorageLocationCrudModal
          key={`${modal.mode}-${modal.record?._id || modal.parent?._id || 'new'}`}
          mode={modal.mode}
          record={modal.record}
          parent={modal.parent}
          warehouse={warehouse}
          rows={rows}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
      <ConfirmModal
        show={Boolean(removing)}
        title={removing ? `Xóa ${labelOf(STORAGE_TYPE_LABELS, removing.type, '').toLowerCase()} “${removing.code} — ${removing.name}”?` : ''}
        body="Vị trí đã xóa không thể khôi phục."
        confirmText="Xóa"
        variant="danger"
        onHide={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </WarehousePageLayout>
  );
}
