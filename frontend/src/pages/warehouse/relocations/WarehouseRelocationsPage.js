import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import inventoryLocationService from '../../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../../services/warehouse/storageLocationService';
import inventoryReportService from '../../../services/warehouse/inventoryReportService';
import stockRelocationService from '../../../services/warehouse/stockRelocationService';
import { ConfirmModal, EmptyState, PageHeader, Pagination, StatusBadge } from '../../../components/warehouse';
import { RELOCATION_STATUS_LABELS, RELOCATION_TYPE_LABELS, labelOf } from '../../../constants/warehouseLabels';
import WarehousePageLayout from '../shared/WarehousePageLayout';
import usePagedList from '../shared/usePagedList';
import SlipListToolbar, { statusOptionsFrom } from '../shared/SlipListToolbar';
import { formatDateTime, idOf, isConflict } from '../shared/slipHelpers';
import InventoryPickerModal from './InventoryPickerModal';
import RelocationCreateModal from './RelocationCreateModal';
import RelocationDetailModal from './RelocationDetailModal';
import {
  addInventoryRows, buildCompletePayload, buildRelocationItems, validateMoveLines,
} from './relocationHelpers';

const STATUS_OPTIONS = statusOptionsFrom(RELOCATION_STATUS_LABELS);

/**
 * Dữ liệu cho form tạo phiếu (chỉ chủ kho): kệ đang hoạt động của kho tổng, nhân viên kho
 * và tồn theo biến thể ở cấp kệ của kho tổng.
 */
function useRelocationMasterData(isManager) {
  const [data, setData] = useState({ shelves: [], staff: [], inventory: [], error: '' });
  const [version, setVersion] = useState(0);
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
  }, [isManager, version]);
  // Tải lại tồn sau khi tạo / hủy phiếu (khả dụng ở kệ nguồn đã đổi).
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...data, reload };
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
          {list.loading && <tr className="wm-loading-row"><td colSpan="8">Đang tải phiếu di chuyển hàng...</td></tr>}
          {!list.loading && list.items.map((row) => (
            <tr key={row._id}>
              <td><strong>{row.relocationCode}</strong></td>
              <td>{labelOf(RELOCATION_TYPE_LABELS, row.operationType, 'Di chuyển hàng')}</td>
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

/** Form tạo phiếu của chủ kho: dòng di chuyển, nhân viên, lỗi form. */
function useCreateForm(onCreated) {
  const [show, setShow] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [lines, setLines] = useState([]);
  const [assigned, setAssigned] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const open = () => {
    setError('');
    setShow(true);
  };
  const addGoods = (rows) => {
    setLines((old) => addInventoryRows(old, rows));
    setShowPicker(false);
  };
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!assigned) {
      setError('Vui lòng chọn nhân viên kho.');
      return;
    }
    const message = validateMoveLines(lines);
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    try {
      await stockRelocationService.create({ assignedStaffId: assigned, operationType: 'move', items: buildRelocationItems(lines) });
      setShow(false);
      setLines([]);
      setAssigned('');
      await onCreated();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };
  return {
    show, showPicker, setShowPicker, lines, setLines, assigned, setAssigned, error, busy, open, close: () => setShow(false),
    addGoods, submit,
  };
}

/**
 * Màn "Di chuyển hàng giữa các kệ" của kho tổng (thay hai màn tách / gộp cũ).
 * Chủ kho tạo phiếu và giao nhân viên, hủy khi chưa hoàn tất; nhân viên được giao bắt đầu và hoàn tất.
 * Phiếu tách / gộp cũ vẫn hiện trong danh sách với nhãn "Tách (cũ)" / "Gộp (cũ)".
 */
export default function WarehouseRelocationsPage({ mode = 'manager' }) {
  const isManager = mode === 'manager';
  const isStaff = mode === 'staff';
  const master = useRelocationMasterData(isManager);
  const fetchPage = useCallback((params) => stockRelocationService.listPage(params), []);
  const list = usePagedList(fetchPage);
  const [selected, setSelected] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [notice, setNotice] = useState('');
  const form = useCreateForm(async () => {
    setNotice('Đã tạo phiếu và giao nhân viên.');
    master.reload();
    await list.reload();
  });

  const openDetail = async (id) => {
    setError('');
    setDetailError('');
    try {
      setSelected(await stockRelocationService.get(id));
    } catch (openError) {
      setError(openError.message);
    }
  };

  /** Chạy một thao tác trên phiếu đang mở; luôn tải lại phiếu và danh sách (kể cả khi 409). */
  const runAction = async (action, message) => {
    setBusy(true);
    setDetailError('');
    setNotice('');
    try {
      const result = await action();
      setSelected(result?._id ? result : await stockRelocationService.get(selected._id));
      setNotice(message);
      await list.reload();
    } catch (actionError) {
      setDetailError(actionError.message);
      if (isConflict(actionError)) {
        await list.reload();
        setSelected(await stockRelocationService.get(selected._id).catch(() => selected));
      }
    } finally {
      setBusy(false);
    }
  };

  const start = () => runAction(() => stockRelocationService.start(selected._id), 'Đã bắt đầu thực hiện phiếu.');
  const complete = (confirmations) => runAction(
    () => stockRelocationService.complete(selected._id, buildCompletePayload(selected, confirmations)),
    'Đã hoàn tất di chuyển hàng.',
  );
  const confirmCancel = async () => {
    try {
      await stockRelocationService.cancel(selected._id);
    } catch (cancelError) {
      // Phiếu vừa hoàn tất / hủy ở nơi khác: tải lại, giữ lỗi trong hộp thoại.
      if (isConflict(cancelError)) {
        await list.reload();
        setSelected(await stockRelocationService.get(selected._id).catch(() => selected));
      }
      throw cancelError;
    }
    setShowCancel(false);
    setNotice('Đã hủy phiếu và nhả hàng đang giữ ở kệ nguồn.');
    master.reload();
    await list.reload();
    setSelected(await stockRelocationService.get(selected._id).catch(() => null));
  };

  const pageError = error || list.error || master.error;

  return (
    <WarehousePageLayout mode={mode}>
      <PageHeader
        eyebrow="KHO TỔNG / VẬN HÀNH"
        title="Di chuyển hàng giữa các kệ"
        description={isManager
          ? 'Chuyển hàng từ kệ này sang kệ khác trong kho tổng: tách một kệ ra nhiều kệ hoặc gộp nhiều kệ về một kệ.'
          : 'Các phiếu di chuyển hàng được giao cho bạn: bắt đầu, chuyển hàng rồi xác nhận hoàn tất.'}
        actions={isManager && <Button variant="dark" onClick={form.open}>Tạo phiếu</Button>}
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
        {!list.loading && !list.items.length && <EmptyState title="Chưa có phiếu di chuyển hàng." />}
        <Pagination page={list.page} limit={list.limit} total={list.total} onChange={list.setPage}
          onLimitChange={list.setLimit} disabled={list.loading} />
      </section>

      {isManager && (
        <RelocationCreateModal
          show={form.show && !form.showPicker}
          staff={master.staff}
          assigned={form.assigned}
          setAssigned={form.setAssigned}
          lines={form.lines}
          setLines={form.setLines}
          shelves={master.shelves}
          error={form.error}
          busy={form.busy}
          onPickGoods={() => form.setShowPicker(true)}
          onSubmit={form.submit}
          onHide={form.close}
        />
      )}
      {form.showPicker && (
        <InventoryPickerModal inventory={master.inventory} onHide={() => form.setShowPicker(false)} onAdd={form.addGoods} />
      )}
      {selected && !showCancel && (
        <RelocationDetailModal
          key={`${selected._id}-${selected.status}`}
          relocation={selected}
          isManager={isManager}
          isStaff={isStaff}
          busy={busy}
          error={detailError}
          onStart={start}
          onComplete={complete}
          onCancel={() => setShowCancel(true)}
          onClose={() => setSelected(null)}
        />
      )}
      <ConfirmModal
        show={showCancel && Boolean(selected)}
        title={`Hủy phiếu ${selected?.relocationCode || ''}`}
        body="Hàng đang giữ ở kệ nguồn sẽ được nhả lại thành khả dụng. Nếu nhân viên đã bắt đầu chuyển, hãy báo họ đưa hàng về kệ nguồn."
        confirmText="Hủy phiếu"
        variant="danger"
        onHide={() => setShowCancel(false)}
        onConfirm={confirmCancel}
      />
    </WarehousePageLayout>
  );
}
