import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import WarehouseCrudModal from '../../components/WarehouseCrudModal';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import { useAuth } from '../../context/AuthContext';
import categoryService from '../../services/masterdata/categoryService';
import productService from '../../services/masterdata/productService';
import productVariantService from '../../services/masterdata/productVariantService';
import supplierService from '../../services/masterdata/supplierService';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import warehouseManagerService from '../../services/warehouse/warehouseManagerService';
import StorageLocationPage from './StorageLocationPage';
import '../../styles/WarehouseManager.css';
import '../../styles/ShopDashboard.css';

const services = { categories: categoryService, products: productService, variants: productVariantService, suppliers: supplierService, inventoryLocations: inventoryLocationService, warehouseManagers: warehouseManagerService };
const configs = {
  'inventory-locations': { service: 'inventoryLocations', title: 'Kho / cửa hàng', searchFields: ['code', 'name', 'address'], filters: [
    ['type', 'Loại vị trí', ['warehouse:Kho', 'store:Cửa hàng']], ['status', 'Trạng thái', ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ], fields: [
    ['code', 'Mã vị trí', 'text', true], ['name', 'Tên vị trí', 'text', true], ['type', 'Loại', 'select', true, ['warehouse:Kho', 'store:Cửa hàng']], ['address', 'Địa chỉ', 'text'], ['managerId', 'Quản lý kho', 'relation', false, 'warehouseManagers', 'FullName'], ['maxCapacity', 'Sức chứa tối đa (cái)', 'number'], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ] },
  categories: { service: 'categories', title: 'Loại sản phẩm', fields: [
    ['parentCategoryId', 'Loại cha', 'relation', false, 'categories', 'name'], ['name', 'Tên loại', 'text', true], ['description', 'Mô tả', 'text'], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ] },
  products: { service: 'products', title: 'Sản phẩm', multipleFields: ['categoryId'], listFields: [['productCode', 'Mã sản phẩm'], ['name', 'Tên sản phẩm'], ['categoryId', 'Loại sản phẩm'], ['tag', 'Hình thức'], ['trackingType', 'Kiểu quản lý'], ['status', 'Trạng thái']], fields: [
    ['categoryId', 'Loại sản phẩm', 'relation', true, 'categories', 'name'], ['productCode', 'Mã sản phẩm', 'text', true], ['name', 'Tên sản phẩm', 'text', true], ['description', 'Mô tả', 'text'], ['tag', 'Hình thức', 'select', false, ['sale:Bán', 'rental:Cho thuê', 'both:Bán và cho thuê']], ['trackingType', 'Kiểu quản lý', 'select', true, ['quantity:Theo số lượng', 'individual:Theo từng cá thể']], ['brand', 'Thương hiệu', 'text'], ['material', 'Chất liệu', 'text'], ['gender', 'Giới tính', 'text'], ['aiTryOn', 'Thử đồ AI', 'select', false, ['true:Có', 'false:Không']], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động', 'discontinued:Ngừng kinh doanh']],
  ] },
  variants: { service: 'variants', title: 'Biến thể', fields: [
    ['productId', 'Sản phẩm', 'relation', true, 'products', 'name'], ['sku', 'SKU', 'text', true], ['variantName', 'Tên biến thể', 'text'], ['size', 'Kích thước', 'text'], ['color', 'Màu sắc', 'text'], ['salePrice', 'Giá bán', 'number'], ['rentalPricePerDay', 'Giá thuê/ngày', 'number'], ['depositAmount', 'Tiền cọc', 'number'], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ] },
  suppliers: { service: 'suppliers', title: 'Nhà cung cấp', searchFields: ['supplierCode', 'name', 'contactName', 'phone', 'email', 'taxCode'], filters: [
    ['status', 'Trạng thái', ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ], fields: [
    ['supplierCode', 'Mã nhà cung cấp', 'text', true], ['name', 'Tên nhà cung cấp', 'text', true], ['contactName', 'Người liên hệ', 'text'], ['phone', 'Số điện thoại', 'text'], ['email', 'Email', 'email'], ['taxCode', 'Mã số thuế', 'text'], ['address', 'Địa chỉ', 'text'], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ] },
};

const display = (value) => value == null || value === '' ? '—' : typeof value === 'object' ? value.FullName || value.name || value.code || value._id : String(value);
const optionItems = (options) => options.map((option) => { const [value, label] = option.split(':'); return { value, label }; });

export default function WarehouseManagerPage() {
  const { resource = 'inventory-locations' } = useParams();
  if (resource === 'storage-locations') return <StorageLocationPage />;
  if (!configs[resource]) return <Navigate to="/warehousemanager/inventory-locations" replace />;
  return <WarehouseResourceList key={resource} config={configs[resource]} />;
}

function WarehouseResourceList({ config }) {
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isBranchManager = /branch_manager/i.test(user?.roleName || user?.Role || user?.role || '');
  const isShopOwner = /shop_owner|owner/i.test(user?.roleName || user?.Role || user?.role || '');
  const isAtelierStaff = isBranchManager || isShopOwner;

  const service = services[config.service];
  const [rows, setRows] = useState([]);
  const [choices, setChoices] = useState({});
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await service.list());
      const related = [...new Set(config.fields.filter((field) => field[2] === 'relation').map((field) => field[4]))];
      if (config.service === 'products') related.push('variants');
      const entries = await Promise.all(related.map(async (name) => [name, await services[name].list()]));
      setChoices(Object.fromEntries(entries));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [service, config]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, filters, pageSize]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesSearch = !query || (config.searchFields || config.fields.map((field) => field[0])).some((field) => String(display(row[field])).toLowerCase().includes(query.toLowerCase()));
    const matchesFilters = Object.entries(filters).every(([field, value]) => !value || String(row[field]) === value);
    return matchesSearch && matchesFilters;
  }), [rows, query, config, filters]);
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const visibleFields = config.listFields || config.fields;
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const save = async (payload) => {
    if (modal.mode === 'edit') await service.update(modal.record._id, payload);
    else await service.create(payload);
    await load();
  };
  const remove = async (row) => {
    const label = row.name || row.code || row.supplierCode || row.productCode || row.sku || 'dữ liệu này';
    if (!window.confirm('Xóa “' + label + '”?')) return;
    try { await service.remove(row._id); await load(); }
    catch (err) { setError(err.message); }
  };

  const resourceContent = (
    <>
      <header className="wm-header">
        <div><span>WAREHOUSE MANAGER / DANH MỤC DÙNG CHUNG</span><h1>{config.title}</h1></div>
        <button className="wm-primary-button" onClick={() => setModal({ mode: 'create', record: null })}>+ Thêm mới</button>
      </header>
      {error && <div className="wm-error">{error}</div>}
      <section className="wm-panel wm-list-panel">
        <div className="wm-list-toolbar">
          <label className="wm-search-field">Tìm kiếm<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={'Tìm ' + config.title.toLowerCase() + '...'} /></label>
          {(config.filters || []).map(([field, label, options]) => <label key={field}>{label}<select value={filters[field] || ''} onChange={(event) => setFilters({ ...filters, [field]: event.target.value })}><option value="">Tất cả</option>{optionItems(options).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
          <label className="wm-page-size">Số dòng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
        </div>
        <div className="wm-table-wrap">
          <table>
            <thead>
              <tr>{visibleFields.map(([key, label]) => <th key={key}>{label}</th>)}<th>Thao tác</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={visibleFields.length + 1}>Đang tải dữ liệu...</td></tr> : pageRows.length ? pageRows.map((row) => (
                <tr key={row._id}>
                  {visibleFields.map(([key]) => <td key={key}>{Array.isArray(row[key]) ? row[key].map(display).join(', ') : display(row[key])}</td>)}
                  <td className="wm-actions">
                    <button type="button" className="secondary" onClick={() => setModal({ mode: 'view', record: row })}>Xem</button>
                    <button type="button" className="secondary" onClick={() => setModal({ mode: 'edit', record: row })}>Sửa</button>
                    <button type="button" className="danger" onClick={() => remove(row)}>Xóa</button>
                  </td>
                </tr>
              )) : <tr><td colSpan={visibleFields.length + 1}>Không có dữ liệu phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="wm-pagination">
          <span>{filteredRows.length ? ((page - 1) * pageSize + 1) + '–' + Math.min(page * pageSize, filteredRows.length) + ' / ' + filteredRows.length : '0 kết quả'}</span>
          <div>
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
            <span>Trang {page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button>
          </div>
        </div>
      </section>
      {modal && <WarehouseCrudModal key={modal.mode + '-' + (modal.record?._id || 'new')} config={config} mode={modal.mode} record={modal.record} choices={choices} onClose={() => setModal(null)} onSave={save} />}
    </>
  );

  if (isAtelierStaff) {
    return (
      <div className="shop-dashboard-layout">
        {isBranchManager ? (
          <BranchSidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        ) : (
          <OwnerSidebar
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        )}
        <div className="admin-main-viewport">
          <OwnerTopHeader
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
            breadcrumb={config.title}
          />
          <main className="shop-main-content">
            <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
              <div>
                <h1 className="admin-page-title" style={{ fontSize: '26px', margin: 0 }}>
                  {config.title}
                </h1>
                <p className="admin-page-desc" style={{ color: '#64748B', fontSize: '13px', marginTop: '4px', margin: 0 }}>
                  Quản lý danh mục & kho lưu trữ chi nhánh Vestora
                </p>
              </div>
              <span className="badge bg-light text-dark border p-2" style={{ fontSize: '0.85rem' }}>
                Sức chứa tính theo cái
              </span>
            </div>
            {resourceContent}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="wm-layout">
      <WarehouseSidebar />
      <main className="wm-main">
        {resourceContent}
      </main>
    </div>
  );
}
