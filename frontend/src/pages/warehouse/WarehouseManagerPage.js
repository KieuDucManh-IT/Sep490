import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import { useAuth } from '../../context/AuthContext';
import categoryService from '../../services/warehouse/categoryService';
import productService from '../../services/warehouse/productService';
import productVariantService from '../../services/warehouse/productVariantService';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import '../../styles/WarehouseManager.css';
import '../../styles/ShopDashboard.css';

const configs = {
  'inventory-locations': { service: 'inventoryLocations', title: 'Vị trí lưu trữ', fields: [
    ['code', 'Mã vị trí', 'text', true], ['name', 'Tên vị trí', 'text', true], ['type', 'Loại', 'select', true, ['warehouse:Kho', 'store:Cửa hàng']], ['address', 'Địa chỉ', 'text'], ['maxCapacity', 'Sức chứa tối đa (cái)', 'number'], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ] },
  'storage-locations': { service: 'storageLocations', title: 'Ô / kệ lưu trữ', fields: [
    ['locationId', 'Vị trí lưu trữ', 'relation', true, 'inventoryLocations', 'name'], ['parentStorageId', 'Vị trí cha', 'relation', false, 'storageLocations', 'name'], ['code', 'Mã ô/kệ', 'text', true], ['name', 'Tên ô/kệ', 'text', true], ['type', 'Loại', 'select', true, ['zone:Khu', 'row:Dãy', 'shelf:Kệ', 'temporary_area:Khu tạm']], ['maxCapacity', 'Sức chứa tối đa (cái)', 'number'], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ] },
  categories: { service: 'categories', title: 'Loại sản phẩm', fields: [
    ['parentCategoryId', 'Loại cha', 'relation', false, 'categories', 'name'], ['name', 'Tên loại', 'text', true], ['description', 'Mô tả', 'text'], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ] },
  products: { service: 'products', title: 'Sản phẩm', fields: [
    ['categoryId', 'Loại sản phẩm', 'relation', true, 'categories', 'name'], ['productCode', 'Mã sản phẩm', 'text', true], ['name', 'Tên sản phẩm', 'text', true], ['description', 'Mô tả', 'text'], ['productType', 'Hình thức', 'select', true, ['sale:Bán', 'rental:Cho thuê', 'both:Bán và cho thuê']], ['trackingType', 'Kiểu quản lý', 'select', true, ['quantity:Theo số lượng', 'individual:The individual']], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động', 'discontinued:Ngừng kinh doanh']],
  ] },
  variants: { service: 'variants', title: 'Biến thể', fields: [
    ['productId', 'Sản phẩm', 'relation', true, 'products', 'name'], ['sku', 'SKU', 'text', true], ['variantName', 'Tên biến thể', 'text'], ['size', 'Kích thước', 'text'], ['color', 'Màu sắc', 'text'], ['salePrice', 'Giá bán', 'number'], ['rentalPricePerDay', 'Giá thuê/ngày', 'number'], ['depositAmount', 'Tiền cọc', 'number'], ['status', 'Trạng thái', 'select', true, ['active:Hoạt động', 'inactive:Ngừng hoạt động']],
  ] },
};

const services = {
  categories: categoryService,
  products: productService,
  variants: productVariantService,
  inventoryLocations: inventoryLocationService,
  storageLocations: storageLocationService,
};

const emptyForm = (config) => Object.fromEntries(config.fields.map(([key]) => [key, '']));
const displayValue = (value) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return value.name || value.code || value._id || '—';
  return String(value);
};

export default function WarehouseManagerPage() {
  const { resource = 'inventory-locations' } = useParams();
  if (!configs[resource]) return <Navigate to="/warehousemanager/inventory-locations" replace />;
  return <WarehouseResourcePage key={resource} config={configs[resource]} />;
}

function WarehouseResourcePage({ config }) {
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isBranchManager = /branch_manager/i.test(user?.roleName || user?.Role || user?.role || '');
  const isShopOwner = /shop_owner|owner/i.test(user?.roleName || user?.Role || user?.role || '');
  const isAtelierStaff = isBranchManager || isShopOwner;

  const [rows, setRows] = useState([]);
  const [choices, setChoices] = useState({});
  const [form, setForm] = useState(emptyForm(config));
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const service = services[config.service];

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await service.list());
      const relationResources = [...new Set(config.fields.filter((field) => field[2] === 'relation').map((field) => field[4]))];
      const entries = await Promise.all(relationResources.map(async (name) => {
        return [name, await services[name].list()];
      }));
      setChoices(Object.fromEntries(entries));
    } catch (err) { setError(err.message); }
  }, [service, config]);

  useEffect(() => { load(); }, [load]);
  const columns = useMemo(() => config.fields, [config]);

  const startEdit = (row) => {
    setEditing(row._id);
    setForm(Object.fromEntries(config.fields.map(([key]) => [key, row[key]?._id || row[key] || ''])));
  };
  const reset = () => { setEditing(null); setForm(emptyForm(config)); };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    const payload = {};
    config.fields.forEach(([key, , type, required]) => {
      if (form[key] !== '') payload[key] = type === 'number' ? Number(form[key]) : form[key];
      else if (!required && type === 'relation') payload[key] = null;
      else if (!required && type === 'text') payload[key] = '';
    });
    try {
      if (editing) await service.update(editing, payload);
      else await service.create(payload);
      reset(); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const remove = async (row) => {
    if (!window.confirm(`Xóa “${row.name || row.code || row.sku || row.productCode || 'dữ liệu này'}”?`)) return;
    try { await service.remove(row._id); await load(); }
    catch (err) { setError(err.message); }
  };

  const resourceContent = (
    <>
      {error && <div className="wm-error">{error}</div>}
      <section className="wm-panel">
        <h2>{editing ? 'Cập nhật thông tin' : `Thêm ${config.title.toLowerCase()}`}</h2>
        <form className="wm-form" onSubmit={submit}>
          {config.fields.map(([key, label, type, required, optionOrResource, displayKey]) => (
            <label key={key}>{label}{type === 'select' || type === 'relation' ? (
              <select required={required} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>
                <option value="">{required ? 'Chọn...' : 'Không chọn'}</option>
                {(type === 'relation' ? choices[optionOrResource] || [] : optionOrResource.map((option) => { const [value, text] = option.split(':'); return { _id: value, [displayKey || 'name']: text }; })).filter((item) => !(key === 'parentCategoryId' || key === 'parentStorageId') || item._id !== editing).map((item) => <option key={item._id} value={item._id}>{item[displayKey || 'name'] || item.code || item._id}</option>)}
              </select>
            ) : <input required={required} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '1' : undefined} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</label>
          ))}
          <div className="wm-form-actions"><button disabled={busy}>{busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm mới'}</button>{editing && <button type="button" className="secondary" onClick={reset}>Hủy sửa</button>}</div>
        </form>
      </section>
      <section className="wm-panel"><div className="wm-table-heading"><h2>Danh sách {config.title.toLowerCase()}</h2><button className="secondary" onClick={load}>Tải lại</button></div>
        <div className="wm-table-wrap"><table><thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}<th>Thao tác</th></tr></thead>
          <tbody>{rows.length ? rows.map((row) => <tr key={row._id}>{columns.map(([key]) => <td key={key}>{displayValue(row[key])}</td>)}<td className="wm-actions"><button className="secondary" onClick={() => startEdit(row)}>Sửa</button><button className="danger" onClick={() => remove(row)}>Xóa</button></td></tr>) : <tr><td colSpan={columns.length + 1}>Chưa có dữ liệu.</td></tr>}</tbody>
        </table></div>
      </section>
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
        <header className="wm-header"><div><span>WAREHOUSE MANAGER / DANH MỤC</span><h1>{config.title}</h1></div><span className="wm-unit">Sức chứa tính theo cái</span></header>
        {resourceContent}
      </main>
    </div>
  );
}

