import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import inventoryLocationService from '../../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../../services/warehouse/storageLocationService';
import inventoryReportService from '../../../services/warehouse/inventoryReportService';
import stockRelocationService from '../../../services/warehouse/stockRelocationService';
import { EmptyState, PageHeader, Pagination, StatusBadge } from '../../../components/warehouse';
import { RELOCATION_STATUS_LABELS, RELOCATION_TYPE_LABELS, labelOf } from '../../../constants/warehouseLabels';
import WarehousePageLayout from '../shared/WarehousePageLayout';
import usePagedList from '../shared/usePagedList';
import SlipListToolbar, { statusOptionsFrom } from '../shared/SlipListToolbar';
import { formatDateTime, idOf } from '../shared/slipHelpers';
import InventoryPickerModal from './InventoryPickerModal';
import RelocationCreateModal from './RelocationCreateModal';
import RelocationDetailModal from './RelocationDetailModal';
import { addRowsToGroups, buildRelocationItems, validateGroups } from './relocationHelpers';

const STATUS_OPTIONS = statusOptionsFrom(RELOCATION_STATUS_LABELS);

/**
 * Dữ liệu cho form tạo phiếu (chỉ chủ kho): kệ đang hoạt động của kho tổng, nhân viên kho
 * và tồn theo biến thể ở cấp kệ của kho tổng.
 */
function useRelocationMasterData(isManager) {
  const [data, setData] = useState({ shelves: [], staff: [], inventory: [], error: '' });
  useEffect(() => {
    if (!isManager) return undefined;
    let active = true;
    const load = async () => {
      const [locations, storages, staff] = await Promise.all([
        inventoryLocationService.list(),
        storageLocationService.list(),
        stockRelocationService.listStaff(),
      ]);
      const centrals = locations.filter((row) => row.type === 'warehouse' && row.status === 'active');
      const central = centrals.length === 1 ? centrals[0] : null;
      const shelves = (storages || []).filter((row) => row.type === 'shelf' && row.status === 'active'
        && idOf(row.locationId) === idOf(central));
      let inventory = [];
      if (central) {
        const report = await inventoryReportService.get({ locationId: central._id, storageLevel: 'shelf', itemLevel: 'variant' });
        inventory = report.items || [];
      }
      return { shelves, staff: staff || [], inventory, error: '' };
    };
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((loadError) => {
        if (active) setData((old) => ({ ...old, error: loadError.message }));
      });
    return () => {
      active = false;
    };
  }, [isManager]);
  return data;
}

function RelocationTable({ list, onOpen }) {
  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã phiếu</th>
            <th>Loại</th>
            <th>Nhân viên</th>
            <th>Dòng hàng</th>
            <th>Tổng số lượng</th>
            <th>Trạng thái</th>
            <th>Ngày tạo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.loading && <tr className="wm-loading-row"><td colSpan="8">Đang tải phiếu tách / gộp tồn...</td></tr>}
          {!list.loading && list.items.map((row) => (
            <tr key={row._id}>
              <td><strong>{row.relocationCode}</strong></td>
              <td>{labelOf(RELOCATION_TYPE_LABELS, row.operationType, '—')}</td>
              <td>{row.assignedStaffId?.FullName || '—'}</td>
              <td>{row.lineCount ?? 0}</td>
              <td>{row.totalQuantity ?? 0}</td>
              <td><StatusBadge status={row.status} labels={RELOCATION_STATUS_LABELS} fallback={row.status} /></td>
              <td>{formatDateTime(row.createdAt)}</td>
              <td><Button size="sm" variant="outline-secondary" onClick={() => onOpen(row._id)}>Chi tiết</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Màn tách tồn / gộp tồn trong kho tổng. Chủ kho tạo phiếu (theo `operationType`) và giao nhân viên;
 * nhân viên xem các phiếu được giao.
 */
export default function WarehouseRelocationsPage({ mode = 'manager', operationType = '' }) {
  const isManager = mode === 'manager';
  const master = useRelocationMasterData(isManager);
  const fetchPage = useCallback(
    (params) => stockRelocationService.listPage(operationType ? { ...params, operationType } : params),
    [operationType],
  );
  const list = usePagedList(fetchPage);
  const [showCreate, setShowCreate] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [groups, setGroups] = useState([]);
  const [assigned, setAssigned] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const shelfCode = (storageId) => master.shelves.find((shelf) => idOf(shelf) === idOf(storageId))?.code || 'Không xác định';

  const addGoods = (rows) => {
    setGroups((old) => addRowsToGroups(old, rows, operationType));
    setShowPicker(false);
  };

  const create = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!assigned) {
      setFormError('Vui lòng chọn nhân viên kho.');
      return;
    }
    const message = validateGroups(groups, operationType);
    if (message) {
      setFormError(message);
      return;
    }
    setBusy(true);
    try {
      await stockRelocationService.create({
        assignedStaffId: assigned,
        operationType,
        items: buildRelocationItems(groups, operationType),
      });
      setShowCreate(false);
      setGroups([]);
      setAssigned('');
      setNotice('Đã tạo phiếu và giao nhân viên.');
      await list.reload();
    } catch (createError) {
      setFormError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id) => {
    setError('');
    try {
      setSelected(await stockRelocationService.get(id));
    } catch (openError) {
      setError(openError.message);
    }
  };

  const title = labelOf(RELOCATION_TYPE_LABELS, operationType, 'Tách / gộp tồn');
  const pageError = error || list.error || master.error;

  return (
    <WarehousePageLayout mode={mode}>
      <PageHeader
        eyebrow="KHO TỔNG / KIỂM SOÁT TỒN KHO"
        title={operationType ? `${title} kho` : title}
        description="Chuyển hàng giữa các kệ trong kho tổng: tách một kệ ra nhiều kệ, hoặc gộp nhiều kệ về một kệ."
        actions={isManager && (
          <Button variant="dark" onClick={() => { setFormError(''); setShowCreate(true); }}>Tạo phiếu</Button>
        )}
      />
      {pageError && <div className="wm-error">{pageError}</div>}
      {notice && <div className="wm-success">{notice}</div>}

      <section className="wm-panel wm-list-panel">
        <SlipListToolbar
          searchLabel="Tìm mã phiếu, kho hoặc nhân viên"
          searchValue={list.searchInput}
          onSearchChange={list.setSearchInput}
          status={list.status}
          onStatusChange={list.setStatus}
          statusOptions={STATUS_OPTIONS}
        />
        <RelocationTable list={list} onOpen={openDetail} />
        {!list.loading && !list.items.length && <EmptyState title="Chưa có phiếu tách / gộp tồn kho." />}
        <Pagination page={list.page} limit={list.limit} total={list.total} onChange={list.setPage}
          onLimitChange={list.setLimit} disabled={list.loading} />
      </section>

      {isManager && (
        <RelocationCreateModal
          show={showCreate && !showPicker}
          operationType={operationType}
          staff={master.staff}
          assigned={assigned}
          setAssigned={setAssigned}
          groups={groups}
          setGroups={setGroups}
          shelves={master.shelves}
          shelfCode={shelfCode}
          error={formError}
          busy={busy}
          onPickGoods={() => { setFormError(''); setShowPicker(true); }}
          onSubmit={create}
          onHide={() => setShowCreate(false)}
        />
      )}
      {showPicker && (
        <InventoryPickerModal inventory={master.inventory} onHide={() => setShowPicker(false)} onAdd={addGoods} />
      )}
      {selected && <RelocationDetailModal relocation={selected} onClose={() => setSelected(null)} />}
    </WarehousePageLayout>
  );
}
