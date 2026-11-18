import React, { useCallback, useEffect, useState } from 'react';
import stockDiscrepancyService from '../../../services/warehouse/stockDiscrepancyService';
import inventoryLocationService from '../../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../../services/warehouse/storageLocationService';
import { PageHeader } from '../../../components/warehouse';
import WarehousePageLayout from '../shared/WarehousePageLayout';
import usePagedList from '../shared/usePagedList';
import { idOf } from '../shared/slipHelpers';
import DiscrepancyDetailModal from './DiscrepancyDetailModal';
import DiscrepancyListPanel from './DiscrepancyListPanel';
import ResolveDiscrepancyModal from './ResolveDiscrepancyModal';
import { permissionMessage } from './discrepancyHelpers';

/** Kho tổng duy nhất đang hoạt động và các kệ của nó (nơi nhập lại hàng tìm thấy). */
function useCentralShelves() {
  const [central, setCentral] = useState({ centralId: '', shelves: [], error: '' });
  useEffect(() => {
    let active = true;
    Promise.all([inventoryLocationService.list(), storageLocationService.list()])
      .then(([locations, storages]) => {
        const centrals = (locations || []).filter((row) => row.type === 'warehouse' && row.status === 'active');
        const centralId = centrals.length === 1 ? idOf(centrals[0]) : '';
        const shelves = (storages || []).filter((row) => row.type === 'shelf' && row.status === 'active'
          && idOf(row.locationId) === centralId);
        if (active) setCentral({ centralId, shelves, error: '' });
      })
      .catch((loadError) => {
        if (active) setCentral((old) => ({ ...old, error: permissionMessage(loadError) }));
      });
    return () => {
      active = false;
    };
  }, []);
  return central;
}

/**
 * Màn hàng thiếu khi điều chuyển (chủ kho). Hàng đang điều tra không được bán / cho thuê;
 * chủ kho kết luận tìm thấy (nhập lại kho) hoặc mất (ghi bên chịu trách nhiệm).
 */
export default function WarehouseDiscrepanciesPage() {
  const fetchPage = useCallback((params) => stockDiscrepancyService.list(params), []);
  const list = usePagedList(fetchPage, { initialStatus: 'pending' });
  const { centralId, shelves, error: centralError } = useCentralShelves();
  const [selected, setSelected] = useState(null);
  const [showResolve, setShowResolve] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const openDetail = async (id) => {
    setError('');
    try {
      setSelected(await stockDiscrepancyService.get(id));
    } catch (loadError) {
      setError(permissionMessage(loadError));
    }
  };

  const submitResolve = async (payload) => {
    const updated = await stockDiscrepancyService.resolve(selected._id, payload);
    setSelected(updated);
    setShowResolve(false);
    setNotice(`Đã ghi nhận kết luận cho phiếu ${updated?.discrepancyCode || ''}.`);
    await list.reload();
  };

  const reloadAfterConflict = async () => {
    await list.reload();
    const fresh = await stockDiscrepancyService.get(selected._id).catch(() => null);
    if (fresh) setSelected(fresh);
  };

  const pageError = error || list.error || centralError;

  return (
    <WarehousePageLayout mode="manager" className="wm-stock-control-page">
      <PageHeader
        eyebrow="KHO TỔNG / CHÊNH LỆCH ĐIỀU CHUYỂN"
        title="Hàng thiếu khi điều chuyển"
        description="Hàng thiếu đang điều tra không được bán hay cho thuê. Kết luận tìm thấy để nhập lại, hoặc ghi nhận mất kèm bên chịu trách nhiệm."
      />
      {pageError && <div className="wm-error">{pageError}</div>}
      {notice && <div className="wm-success">{notice}</div>}

      <DiscrepancyListPanel list={list} onOpen={openDetail} />

      {selected && !showResolve && (
        <DiscrepancyDetailModal
          discrepancy={selected}
          onClose={() => setSelected(null)}
          onResolve={() => setShowResolve(true)}
        />
      )}
      {selected && showResolve && (
        <ResolveDiscrepancyModal
          key={selected._id}
          discrepancy={selected}
          centralId={centralId}
          shelves={shelves}
          onHide={() => setShowResolve(false)}
          onSubmit={submitResolve}
          onConflict={reloadAfterConflict}
        />
      )}
    </WarehousePageLayout>
  );
}
