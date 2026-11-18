import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'react-bootstrap';
import { RefreshCw } from 'lucide-react';
import InventorySerialsModal from '../../components/InventorySerialsModal';
import { EmptyState, KpiCards, PageHeader, Pagination } from '../../components/warehouse';
import inventoryReportService from '../../services/warehouse/inventoryReportService';
import { useAuth } from '../../context/AuthContext';
import WarehousePageLayout from './shared/WarehousePageLayout';

const number = (value) => Number(value || 0).toLocaleString('vi-VN');
const STORAGE_LEVEL_OPTIONS = [['zone', 'Khu'], ['row', 'Dãy'], ['shelf', 'Kệ']];
const ITEM_LEVEL_OPTIONS = [['product', 'Sản phẩm'], ['variant', 'Biến thể']];

function summaryCards(summary) {
  const overdue = Number(summary.totalOverdue) || 0;
  return [
    { key: 'onHand', label: 'Tổng tồn', value: summary.totalOnHand, unit: 'cái' },
    { key: 'available', label: 'Có thể sử dụng', value: summary.totalAvailable, unit: 'cái' },
    { key: 'reserved', label: 'Đang giữ chỗ', value: summary.totalReserved, unit: 'cái' },
    { key: 'unavailable', label: 'Không khả dụng', value: summary.totalUnavailable, unit: 'cái' },
    { key: 'renting', label: 'Đang cho thuê', value: summary.totalRenting, unit: 'cái' },
    { key: 'overdue', label: 'Quá hạn trả', value: summary.totalOverdue, unit: 'cái', tone: overdue > 0 ? 'danger' : 'default' },
  ];
}

/** Dòng báo cáo khớp từ khóa (kho, quản lý, vị trí, sản phẩm, danh mục, SKU, size, màu). */
function matchesQuery(row, query) {
  if (!query) return true;
  const text = [row.locationCode, row.locationName, row.managerName, row.storagePath, row.productCode,
    row.productName, row.categoryName, row.sku, row.size, row.color].join(' ');
  return text.toLowerCase().includes(query.toLowerCase());
}

function ReportRow({ row, onShowItems }) {
  const overdue = Number(row.quantityOverdue) > 0;
  return (
    <tr>
      <td><strong>{row.locationCode}</strong><br />{row.locationName}</td>
      <td>{row.managerName || '—'}</td>
      <td>{row.storagePath}</td>
      <td>
        <strong>{row.productName}</strong><br />
        <small>{[row.productCode, row.sku, row.size, row.color].filter(Boolean).join(' · ')}</small>
      </td>
      <td>
        <span>{row.trackingType === 'individual' ? `${number(row.itemCount)} mã hàng` : 'Quản lý theo số lượng'}</span><br />
        <button type="button" className="wm-text-button" onClick={() => onShowItems(row)}>Xem các món hàng tại vị trí</button>
      </td>
      <td>{number(row.quantityOnHand)}</td>
      <td>{number(row.quantityAvailable)}</td>
      <td>{number(row.quantityReserved)}</td>
      <td>{number(row.quantityUnavailable)}</td>
      <td>{number(row.quantityRenting)}</td>
      <td className={overdue ? 'text-danger fw-bold' : undefined}>{number(row.quantityOverdue)}</td>
    </tr>
  );
}

function SelectFilter({ label, value, options, onChange, allLabel }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {allLabel && <option value="">{allLabel}</option>}
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  );
}

/**
 * Báo cáo tồn kho: gộp số tồn theo cấp vị trí (khu / dãy / kệ) và cấp mặt hàng (sản phẩm / biến thể),
 * kèm số đang cho thuê và quá hạn trả. Báo cáo trả toàn bộ dòng một lần nên tìm / phân trang ngay trên trình duyệt.
 */
export default function InventoryReportPage({ mode = 'manager' }) {
  const { user } = useAuth();
  const isStaff = mode === 'staff' || /warehouse_staff/i.test(user?.Role || user?.role || '');
  const [report, setReport] = useState({ items: [], locations: [], summary: {} });
  const [filters, setFilters] = useState({ locationId: '', storageLevel: 'shelf', itemLevel: 'variant' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serialDetail, setSerialDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await inventoryReportService.get(filters));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters, query, pageSize]);

  const filtered = useMemo(() => report.items.filter((row) => matchesQuery(row, query)), [report.items, query]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const setFilter = (key) => (value) => setFilters((old) => ({ ...old, [key]: value }));
  const locationOptions = report.locations.map((location) => [location._id, `${location.code} — ${location.name}`]);

  return (
    <WarehousePageLayout mode={isStaff ? 'staff' : 'manager'}>
      <PageHeader
        eyebrow="KHO TỔNG / BÁO CÁO"
        title="Báo cáo tồn kho"
        description="Tùy chọn cấp vị trí và cấp mặt hàng để gộp số tồn; serial có thể xem trong chi tiết."
        actions={(
          <Button variant="dark" onClick={load} disabled={loading}><RefreshCw size={15} /> Làm mới</Button>
        )}
      />
      {error && <div className="wm-error">{error}</div>}
      <KpiCards items={summaryCards(report.summary)} loading={loading} />
      <section className="wm-panel wm-list-panel">
        <div className="wm-list-toolbar">
          <label className="wm-search-field">
            Tìm mặt hàng
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên sản phẩm, SKU hoặc vị trí..." />
          </label>
          <SelectFilter label="Kho / cửa hàng" value={filters.locationId} options={locationOptions}
            onChange={setFilter('locationId')} allLabel="Tất cả" />
          <SelectFilter label="Gộp vị trí" value={filters.storageLevel} options={STORAGE_LEVEL_OPTIONS}
            onChange={setFilter('storageLevel')} />
          <SelectFilter label="Gộp mặt hàng" value={filters.itemLevel} options={ITEM_LEVEL_OPTIONS}
            onChange={setFilter('itemLevel')} />
        </div>
        <div className="wm-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kho / cửa hàng</th>
                <th>Quản lý</th>
                <th>Vị trí</th>
                <th>Sản phẩm / biến thể</th>
                <th>Mã hàng / serial</th>
                <th>Tồn</th>
                <th>Khả dụng</th>
                <th>Đang giữ</th>
                <th>Không khả dụng</th>
                <th>Đang cho thuê</th>
                <th>Quá hạn trả</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr className="wm-loading-row"><td colSpan={11}>Đang tải báo cáo...</td></tr>}
              {!loading && visible.map((row) => <ReportRow key={row.key} row={row} onShowItems={setSerialDetail} />)}
            </tbody>
          </table>
        </div>
        {!loading && !visible.length && <EmptyState title="Không có tồn kho phù hợp." />}
        <Pagination page={page} limit={pageSize} total={filtered.length} onChange={setPage}
          onLimitChange={setPageSize} limitOptions={[10, 20, 50]} disabled={loading} />
      </section>
      {serialDetail && <InventorySerialsModal item={serialDetail} onClose={() => setSerialDetail(null)} />}
    </WarehousePageLayout>
  );
}
