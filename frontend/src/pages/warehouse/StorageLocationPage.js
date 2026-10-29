import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Pencil, Plus, Trash2, Warehouse } from 'lucide-react';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import StorageLocationCrudModal from '../../components/StorageLocationCrudModal';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import '../../styles/WarehouseManager.css';

const idOf = (value) => (value && typeof value === 'object' ? value._id : value) || '';
const capacityOf = (value) => Number.isInteger(Number(value)) && value !== null && value !== '' ? Number(value) : 0;
const typeLabel = { zone: 'Zone', row: 'Row', shelf: 'Shelf', temporary_area: 'Khu tạm' };
const childCapacity = (rows, parentId, excludeId) => rows.filter((row) => idOf(row.parentStorageId) === parentId && row._id !== excludeId)
  .reduce((sum, row) => sum + capacityOf(row.maxCapacity), 0);

export default function StorageLocationPage() {
  const [locations, setLocations] = useState([]);
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const [locationData, storageData] = await Promise.all([inventoryLocationService.list(), storageLocationService.list()]);
      setLocations(locationData);
      setRows(storageData);
      setExpanded((previous) => Object.fromEntries(storageData.filter((item) => item.type === 'zone').map((item) => [item._id, previous[item._id] ?? true])));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, locationFilter, statusFilter, pageSize]);

  const childrenOf = useCallback((parentId, type) => rows.filter((row) => idOf(row.parentStorageId) === parentId && (!type || row.type === type)), [rows]);
  const matches = useCallback((row) => {
    const queryMatches = !query || [row.code, row.name].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase()));
    return queryMatches && (!statusFilter || row.status === statusFilter);
  }, [query, statusFilter]);
  const visibleRowsForZone = useCallback((zone) => childrenOf(zone._id, 'row').map((row) => ({
    row,
    shelves: childrenOf(row._id, 'shelf').filter(matches),
  })).filter(({ row, shelves }) => matches(row) || shelves.length > 0), [childrenOf, matches]);

  const rootRows = useMemo(() => rows.filter((row) => !idOf(row.parentStorageId) && ['zone', 'temporary_area'].includes(row.type)), [rows]);
  const visibleRoots = useMemo(() => rootRows.filter((root) => {
    if (locationFilter && idOf(root.locationId) !== locationFilter) return false;
    if (matches(root)) return true;
    if (root.type === 'zone') return visibleRowsForZone(root).length > 0;
    return false;
  }), [rootRows, locationFilter, matches, visibleRowsForZone]);
  const pages = Math.max(1, Math.ceil(visibleRoots.length / pageSize));
  const pageRoots = visibleRoots.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const openCreate = (parent = null) => setModal({ mode: 'create', record: null, parent });
  const openRecord = (mode, record) => setModal({ mode, record, parent: null });
  const save = async (payload) => {
    if (modal.mode === 'edit') await storageLocationService.update(modal.record._id, payload);
    else await storageLocationService.create(payload);
    await load();
  };
  const remove = async (row) => {
    if (!window.confirm('Xóa ' + typeLabel[row.type] + ' “' + row.code + ' — ' + row.name + '”?')) return;
    try { await storageLocationService.remove(row._id); await load(); }
    catch (err) { setError(err.message); }
  };

  const actions = (row) => <div className="wm-tree-actions">
    {(row.type === 'zone' || row.type === 'row') && <button type="button" onClick={() => openCreate(row)}><Plus size={14} />Thêm {row.type === 'zone' ? 'row' : 'shelf'}</button>}
    <button type="button" onClick={() => openRecord('view', row)} aria-label={'Xem ' + row.code}><Eye size={14} />Xem</button>
    <button type="button" onClick={() => openRecord('edit', row)} aria-label={'Sửa ' + row.code}><Pencil size={14} />Sửa</button>
    <button type="button" className="danger" onClick={() => remove(row)} aria-label={'Xóa ' + row.code}><Trash2 size={14} />Xóa</button>
  </div>;

  const renderShelf = (shelf) => <div className="wm-tree-node wm-shelf-node" key={shelf._id}>
    <span className="wm-tree-title"><span className="wm-node-type">Shelf</span><strong>{shelf.code}</strong><span>{shelf.name}</span><small>Sức chứa: {shelf.maxCapacity ?? '—'} cái</small></span>{actions(shelf)}
  </div>;

  const renderRow = (row) => {
    const shelves = childrenOf(row._id, 'shelf').filter(matches);
    const isOpen = expanded[row._id] ?? true;
    return <div className="wm-tree-group wm-row-group" key={row._id}>
      <div className="wm-tree-node">
        <button className="wm-tree-toggle" type="button" onClick={() => setExpanded({ ...expanded, [row._id]: !isOpen })}>{isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button>
        <span className="wm-tree-title"><span className="wm-node-type">Row</span><strong>{row.code}</strong><span>{row.name}</span><small>{shelves.length} shelf · {childCapacity(rows, row._id)} / {row.maxCapacity ?? '∞'} cái</small></span>{actions(row)}
      </div>
      {isOpen && <div className="wm-tree-children">{shelves.length ? shelves.map(renderShelf) : <div className="wm-tree-empty">Không có shelf phù hợp.</div>}</div>}
    </div>;
  };

  const renderRoot = (root) => {
    if (root.type === 'temporary_area') return <section className="wm-zone-card" key={root._id}><div className="wm-tree-node wm-zone-node"><Warehouse size={19} className="wm-zone-icon" /><span className="wm-tree-title"><span className="wm-node-type">Khu tạm</span><strong>{root.code}</strong><span>{root.name}</span><small>{root.maxCapacity ?? '—'} cái</small></span>{actions(root)}</div></section>;
    const treeRows = visibleRowsForZone(root);
    const rowsInZone = childrenOf(root._id, 'row');
    const locationName = locations.find((location) => location._id === idOf(root.locationId))?.name;
    const isOpen = expanded[root._id] ?? true;
    return <section className="wm-zone-card" key={root._id}>
      <div className="wm-tree-node wm-zone-node">
        <button className="wm-tree-toggle" type="button" onClick={() => setExpanded({ ...expanded, [root._id]: !isOpen })}>{isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
        <Warehouse size={19} className="wm-zone-icon" />
        <span className="wm-tree-title"><span className="wm-node-type">Zone</span><strong>{root.code}</strong><span>{root.name}</span><small className="wm-tree-location">{locationName}</small><small>{rowsInZone.length} row · {childCapacity(rows, root._id)} / {root.maxCapacity ?? '∞'} cái</small></span>{actions(root)}
      </div>
      {isOpen && <div className="wm-tree-children">{treeRows.length ? treeRows.map(({ row }) => renderRow(row)) : <div className="wm-tree-empty">Không có row phù hợp.</div>}</div>}
    </section>;
  };

  return <div className="wm-layout"><WarehouseSidebar /><main className="wm-main">
    <header className="wm-header"><div><span>WAREHOUSE MANAGER / DANH MỤC DÙNG CHUNG</span><h1>Vị trí lưu trữ</h1><p>Phân cấp Zone → Row → Shelf; sức chứa tính theo cái.</p></div><button className="wm-primary-button" onClick={() => openCreate()}>+ Thêm zone</button></header>
    {error && <div className="wm-error">{error}</div>}
    <section className="wm-panel wm-list-panel">
      <div className="wm-list-toolbar">
        <label className="wm-search-field">Tìm kiếm<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo mã hoặc tên..." /></label>
        <label>Kho / cửa hàng<select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="">Tất cả</option>{locations.map((location) => <option key={location._id} value={location._id}>{location.code} — {location.name}</option>)}</select></label>
        <label>Trạng thái<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tất cả</option><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label>
        <label className="wm-page-size">Số zone/khu<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
      </div>
      {loading ? <div className="wm-tree-empty">Đang tải vị trí lưu trữ...</div> : pageRoots.length ? pageRoots.map(renderRoot) : <div className="wm-tree-empty">Không có vị trí phù hợp.</div>}
      <div className="wm-pagination"><span>{visibleRoots.length ? ((page - 1) * pageSize + 1) + '–' + Math.min(page * pageSize, visibleRoots.length) + ' / ' + visibleRoots.length : '0 kết quả'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button></div></div>
    </section>
    {!loading && !locations.length && <div className="wm-error">Cần tạo kho/cửa hàng trước khi khai báo zone.</div>}
    {modal && <StorageLocationCrudModal key={modal.mode + '-' + (modal.record?._id || modal.parent?._id || 'new')} mode={modal.mode} record={modal.record} parent={modal.parent} locations={locations} parentLocation={modal.record ? locations.find((item) => item._id === idOf(modal.record.locationId)) : modal.parent ? locations.find((item) => item._id === idOf(modal.parent.locationId)) : null} rows={rows} onClose={() => setModal(null)} onSave={save} />}
  </main></div>;
}
