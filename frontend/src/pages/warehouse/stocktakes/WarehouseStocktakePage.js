import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useAuth } from '../../../context/AuthContext';
import stocktakeService from '../../../services/warehouse/stocktakeService';
import WarehouseCancelSlipModal from '../../../components/WarehouseCancelSlipModal';
import { PageHeader } from '../../../components/warehouse';
import WarehousePageLayout from '../shared/WarehousePageLayout';
import usePagedList from '../shared/usePagedList';
import { isConflict } from '../shared/slipHelpers';
import StocktakeCreateForm from './StocktakeCreateForm';
import StocktakeDetailModal from './StocktakeDetailModal';
import StocktakeListPanel from './StocktakeListPanel';
import useStocktakeMasterData from './useStocktakeMasterData';
import useStocktakePreview from './useStocktakePreview';
import { buildCountPayload, emptyCreateForm, validateCounts } from './stocktakeHelpers';

/**
 * Kết quả đang nhập của phiếu đang mở (TASK-016 B2): `results` chỉ giữ dòng đã sửa
 * (dòng chưa sửa lấy kết quả đã lưu, mặc định "Có mặt – dùng được"), và món lạ chưa lưu.
 */
function useCounting() {
  const [results, setResults] = useState({});
  const [newItems, setNewItems] = useState([]);
  const reset = () => { setResults({}); setNewItems([]); };
  const setResult = (lineId, value) => setResults((old) => ({ ...old, [lineId]: value }));
  return { results, newItems, setNewItems, setResult, reset };
}

/**
 * Màn kiểm kê kho tổng. Chủ kho tạo phiếu, bắt đầu, duyệt (= áp dụng ngay vào tồn) và hủy;
 * nhân viên được giao ghi kết quả theo món và gửi.
 */
export default function WarehouseStocktakePage() {
  const { user } = useAuth();
  const role = user?.Role || user?.role || user?.roleName || '';
  const isManager = /warehouse_manager|admin/i.test(role);
  const master = useStocktakeMasterData(isManager);
  const fetchPage = useCallback((params) => stocktakeService.list(params), []);
  const list = usePagedList(fetchPage);
  const counting = useCounting();
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [showCancel, setShowCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const preview = useStocktakePreview(createForm, setError);

  const centralId = master.central?._id || '';

  // Kho tổng tải xong sau khi mở form thì điền luôn vào form tạo phiếu.
  useEffect(() => {
    if (!centralId) return;
    setCreateForm((old) => (old.locationId ? old : { ...old, locationId: centralId }));
  }, [centralId]);

  const openStocktake = async (id) => {
    const row = await stocktakeService.get(id);
    setSelected(row);
    counting.reset(row);
  };

  /** Chạy một thao tác; luôn tải lại danh sách và phiếu đang mở. Trả kết quả hoặc null nếu lỗi. */
  const runAction = async (action, message) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      await list.reload();
      const next = result?.stocktake || result?.data?.stocktake || result;
      if (next?._id) await openStocktake(next._id);
      else if (selected?._id) await openStocktake(selected._id);
      setNotice(typeof message === 'function' ? message(result) : message);
      return result;
    } catch (actionError) {
      setError(actionError.message);
      if (isConflict(actionError) && selected?._id) {
        await list.reload();
        await openStocktake(selected._id).catch(() => {});
      }
      return null;
    } finally {
      setBusy(false);
    }
  };

  const toggleCreate = () => {
    setShowCreate((value) => !value);
    setCreateForm(emptyCreateForm(centralId));
    setSelected(null);
  };

  const createStocktake = async (event) => {
    event.preventDefault();
    if (!createForm.locationId) {
      setError('Hãy chọn kho tổng trước khi tạo phiếu.');
      return;
    }
    const lines = preview.lines();
    if (lines && !lines.length) {
      setError('Hãy chọn ít nhất một dòng hàng, hoặc bỏ danh sách để kiểm mọi dòng trong phạm vi.');
      return;
    }
    const payload = lines ? { ...createForm, lines } : createForm;
    const result = await runAction(() => stocktakeService.create(payload), 'Đã tạo phiếu kiểm kê nháp.');
    const id = result?.data?._id || result?._id;
    if (!id) return;
    setShowCreate(false);
    setCreateForm(emptyCreateForm(centralId));
    await openStocktake(id);
  };

  const saveCounts = async () => {
    const message = validateCounts(counting.newItems);
    if (message) {
      setError(message);
      return false;
    }
    const payload = buildCountPayload(selected.items || [], counting.results, counting.newItems);
    const result = await runAction(() => stocktakeService.saveCounts(selected._id, payload), 'Đã lưu kết quả kiểm.');
    return Boolean(result);
  };

  const submitCounts = async () => {
    const saved = await saveCounts();
    if (!saved) return;
    await runAction(() => stocktakeService.submit(selected._id), 'Đã gửi kết quả kiểm kê.');
  };

  const approve = () => runAction(async () => {
    const result = await stocktakeService.approve(selected._id);
    return { ...(result.stocktake || result), createdAdjustment: result.adjustment };
  }, (stocktake) => {
    const skipped = stocktake?.summary?.skipped ? ` ${stocktake.summary.skipped} dòng bị bỏ qua (xem lý do trong bảng).` : '';
    const code = stocktake?.createdAdjustment?.adjustmentCode;
    if (code) return `Đã duyệt kiểm kê, tạo phiếu điều chỉnh ${code} chờ duyệt.${skipped}`;
    return `Đã duyệt kiểm kê, không có chênh lệch.${skipped}`;
  });

  const confirmCancel = async (reason) => {
    const id = selected._id;
    try {
      await stocktakeService.cancel(id, reason);
    } catch (cancelError) {
      // Phiếu vừa đổi trạng thái ở nơi khác: tải lại để hiện trạng thái mới, giữ lỗi trong hộp thoại.
      if (isConflict(cancelError)) {
        await list.reload();
        await openStocktake(id).catch(() => {});
      }
      throw cancelError;
    }
    setShowCancel(false);
    setError('');
    await list.reload();
    await openStocktake(id).catch((refreshError) => setError(refreshError.message));
    setNotice('Đã hủy phiếu kiểm kê.');
  };

  const detailActions = {
    onCancel: () => setShowCancel(true),
    onStart: () => runAction(() => stocktakeService.start(selected._id), 'Đã bắt đầu kiểm kê và chụp trạng thái từng món.'),
    onSave: saveCounts,
    onSubmit: submitCounts,
    onApprove: approve,
  };

  const openFromList = (id) => {
    setShowCreate(false);
    setError('');
    openStocktake(id).catch((openError) => setError(openError.message));
  };

  const pageError = error || list.error || master.error;

  return (
    <WarehousePageLayout mode={isManager ? 'manager' : 'staff'} className="wm-stock-control-page">
      <PageHeader
        eyebrow="KHO TỔNG / KIỂM SOÁT TỒN KHO"
        title="Kiểm kê kho"
        description="Kiểm từng món theo kệ; duyệt kết quả sinh phiếu điều chỉnh cho các dòng lệch để duyệt rồi áp dụng vào tồn."
        actions={isManager && <Button variant="dark" onClick={toggleCreate}>+ Tạo phiếu kiểm kê</Button>}
      />
      <div className="wm-stock-tabs">
        <Link className="active" to={isManager ? '/warehousemanager/stocktakes' : '/warehousestaff/stocktakes'}>Kiểm kê</Link>
        {isManager && <Link to="/warehousemanager/adjustments">Điều chỉnh</Link>}
      </div>
      {pageError && !selected && <div className="wm-error">{pageError}</div>}
      {notice && <div className="wm-success">{notice}</div>}

      {showCreate && (
        <StocktakeCreateForm
          form={createForm}
          setForm={setCreateForm}
          central={master.central}
          storages={master.storages}
          products={master.products}
          variants={master.variants}
          staff={master.staff}
          busy={busy}
          onSubmit={createStocktake}
          onCancel={() => setShowCreate(false)}
          preview={preview}
        />
      )}

      <StocktakeListPanel list={list} onOpen={openFromList} />

      {selected && !showCancel && (
        <StocktakeDetailModal
          stocktake={selected}
          isManager={isManager}
          busy={busy}
          error={error}
          counting={counting}
          variants={master.variants}
          storages={master.storages}
          actions={detailActions}
          onClose={() => setSelected(null)}
        />
      )}
      <WarehouseCancelSlipModal
        show={showCancel && Boolean(selected)}
        slipLabel="phiếu kiểm kê"
        slipCode={selected?.stocktakeCode}
        onHide={() => setShowCancel(false)}
        onConfirm={confirmCancel}
      />
    </WarehousePageLayout>
  );
}
