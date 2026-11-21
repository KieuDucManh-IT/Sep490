import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import WarehouseCrudModal from '../../components/WarehouseCrudModal';
import categoryService from '../../services/masterdata/categoryService';
import { categoryDepth, isRootCategory } from '../../utils/categoryTree';
import '../../styles/ShopDashboard.css';
import '../../styles/WarehouseManager.css';
import '../../styles/WarehouseShared.css';

// Danh mục tối đa 2 cấp (TASK-014 A3): cấp do server tính từ loại cha; loại cấp 3 cũ chỉ còn hiển thị.
const levelLabel = (depth) => (depth === 1 ? 'Cấp 1' : depth === 2 ? 'Cấp 2' : `Cấp ${depth} (cũ)`);
const config = { service: 'categories', title: 'Loại sản phẩm', defaults: { status: 'active' }, fields: [
  ['parentCategoryId', 'Loại cha', 'relation', false, 'categories', 'name'],
  ['name', 'Tên loại', 'text', true],
  ['description', 'Mô tả', 'text'],
  ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
] };

export default function CategoryManagementPage() {
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await categoryService.list();
      setRows(data);
      setExpanded((previous) => Object.fromEntries(data.map((item) => [item._id, previous[item._id] ?? true])));
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const childrenOf = useCallback((parentId) => rows.filter((row) => String(row.parentCategoryId?._id || row.parentCategoryId || '') === String(parentId)).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const treeMatch = useCallback(function matches(row) {
    const ownMatch = !query || String(row.name || '').toLowerCase().includes(query.toLowerCase());
    return ownMatch || childrenOf(row._id).some(matches);
  }, [query, childrenOf]);
  const roots = useMemo(() => rows.filter((row) => isRootCategory(row) && treeMatch(row)).sort((a, b) => a.name.localeCompare(b.name)), [rows, treeMatch]);

  const save = async (payload) => {
    if (modal.mode === 'edit') await categoryService.update(modal.record._id, payload);
    else await categoryService.create(payload);
    setModal(null);
    await load();
  };
  const remove = async (row) => {
    if (!window.confirm(`Xóa danh mục “${row.name}”?`)) return;
    try { await categoryService.remove(row._id); await load(); }
    catch (removeError) { setError(removeError.message); }
  };
  const addChild = (parent) => {
    setExpanded((current) => ({ ...current, [parent._id]: true }));
    setModal({ mode: 'create', record: { parentCategoryId: parent._id, status: 'active' } });
  };
  const renderNode = (row) => {
    const children = childrenOf(row._id).filter(treeMatch);
    const depth = categoryDepth(row, rows);
    const canExpand = children.length > 0;
    const isOpen = query ? true : expanded[row._id] ?? true;
    return <div className={`wm-category-group wm-category-lv${Math.min(depth, 3)}`} key={row._id}>
      <div className="wm-tree-node wm-category-node">
        <button type="button" className="wm-tree-toggle" disabled={!canExpand} onClick={() => setExpanded((current) => ({ ...current, [row._id]: !isOpen }))} aria-label={isOpen ? 'Thu gọn danh mục' : 'Mở danh mục'}>{canExpand ? isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} /> : null}</button>
        <Tags size={17} className="wm-category-icon" />
        <span className="wm-tree-title"><span className="wm-node-type">{levelLabel(depth)}</span><strong>{row.name}</strong><small>{row.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}</small></span>
        <div className="wm-tree-actions">{depth === 1 && <button type="button" onClick={() => addChild(row)}><Plus size={14} />Thêm cấp 2</button>}<button type="button" onClick={() => setModal({ mode: 'view', record: row })}><Eye size={14} />Xem</button><button type="button" onClick={() => setModal({ mode: 'edit', record: row })}><Pencil size={14} />Sửa</button><button type="button" className="danger" onClick={() => remove(row)}><Trash2 size={14} />Xóa</button></div>
      </div>
      {canExpand && isOpen && <div className="wm-category-children">{children.map(renderNode)}</div>}
    </div>;
  };

  return <div className="shop-dashboard-layout wh-layout"><WarehouseSidebar /><main className="shop-main-content wh-main">
    <header className="wm-header"><div><span>KHO TỔNG / DANH MỤC DÙNG CHUNG</span><h1>Loại sản phẩm</h1><p>Danh mục tối đa 2 cấp: Cấp 1 → Cấp 2. Sản phẩm gắn vào loại cấp cuối.</p></div><button type="button" className="wm-primary-button" onClick={() => setModal({ mode: 'create', record: { status: 'active' } })}>+ Thêm cấp 1</button></header>
    {error && <div className="wm-error">{error}</div>}
    <section className="wm-panel wm-list-panel">
      <div className="wm-list-toolbar"><label className="wm-search-field">Tìm kiếm<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên loại sản phẩm..." /></label><span className="wm-category-total">{rows.length} danh mục</span></div>
      {loading ? <div className="wm-tree-empty">Đang tải danh mục...</div> : roots.length ? roots.map((row) => <section className="wm-zone-card wm-category-card" key={row._id}>{renderNode(row)}</section>) : <div className="wm-tree-empty">Chưa có danh mục phù hợp.</div>}
    </section>
    {modal && <WarehouseCrudModal key={`${modal.mode}-${modal.record?._id || 'new'}`} config={config} mode={modal.mode} record={modal.record} choices={{ categories: rows }} onClose={() => setModal(null)} onSave={save} />}
  </main></div>;
}
