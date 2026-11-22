import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import stockDiscrepancyService from '../services/warehouse/stockDiscrepancyService';
import { ItemCodeGroup } from './warehouse/ItemCodeGroups';

import {
  DISCREPANCY_CONDITION_LABELS,
  DISCREPANCY_OUTCOME_LABELS,
  DISCREPANCY_STATUS_CLASS,
  DISCREPANCY_STATUS_LABELS,
  RESPONSIBLE_PARTY_LABELS,
  TRANSFER_DIRECTION_LABELS,
  formatVariantName,
  labelOf,
} from '../constants/warehouseLabels';
import '../styles/WarehouseShared.css';

// Giữ tên export cũ để các trang đang import (điều chuyển, trả hàng, chênh lệch) không phải đổi.
export const discrepancyStatusLabels = DISCREPANCY_STATUS_LABELS;
export const discrepancyStatusClass = DISCREPANCY_STATUS_CLASS;
export const directionLabels = TRANSFER_DIRECTION_LABELS;
export const responsibleLabels = RESPONSIBLE_PARTY_LABELS;

const idOf = (value) => String(value?._id || value || '');
export const discrepancyVariantLabel = (row) => formatVariantName(row?.variantId);
const locationLabel = (location) => [location?.code, location?.name].filter(Boolean).join(' · ') || '—';

/** Các món của phiếu chênh lệch chưa được kết luận. */
export const unresolvedItems = (discrepancy) => {
  const resolved = new Set((discrepancy?.resolutions || []).flatMap((row) => (row.itemIds || []).map(idOf)));
  return (discrepancy?.itemIds || []).filter((item) => !resolved.has(idOf(item)));
};

export function StockDiscrepancyDetailBody({ discrepancy }) {
  if (!discrepancy) return null;
  const previous = new Map((discrepancy.itemPreviousConditions || []).map((row) => [idOf(row.itemId), row.condition]));
  const resolvedItemIds = new Set((discrepancy.resolutions || []).flatMap((row) => (row.itemIds || []).map(idOf)));
  return <div className="wm-discrepancy-detail">
    <div className="wm-detail-grid">
      <div><small>Trạng thái</small><span className={`wm-status-badge ${DISCREPANCY_STATUS_CLASS[discrepancy.status] || ''}`}>{labelOf(DISCREPANCY_STATUS_LABELS, discrepancy.status, discrepancy.status)}</span></div>
      <div><small>Phiếu điều chuyển gốc</small><strong>{discrepancy.transferId?.transferCode || '—'}</strong></div>
      <div><small>Chiều</small><strong>{labelOf(TRANSFER_DIRECTION_LABELS, discrepancy.direction, discrepancy.direction)}</strong></div>
      <div><small>Nơi gửi → nơi nhận</small><strong>{locationLabel(discrepancy.fromLocationId)} → {locationLabel(discrepancy.toLocationId)}</strong></div>
      <div><small>Sản phẩm / biến thể</small><strong>{discrepancyVariantLabel(discrepancy) || '—'}</strong></div>
      <div><small>Thiếu / đã xử lý</small><strong>{discrepancy.quantityMissing} / {discrepancy.quantityResolved || 0}</strong></div>
      <div><small>Ngày mở</small><strong>{discrepancy.createdAt ? new Date(discrepancy.createdAt).toLocaleString('vi-VN') : '—'}</strong></div>
      <div><small>Người mở</small><strong>{discrepancy.createdBy?.FullName || '—'}</strong></div>
    </div>
    <>
      <h3 className="wm-discrepancy-heading">Các món thiếu</h3>
      <div className="wm-table-wrap"><table><thead><tr><th>Mã hàng</th><th>Serial</th><th>Tình trạng trước khi thiếu</th><th>Kết luận</th></tr></thead><tbody>
        {(discrepancy.itemIds || []).length ? discrepancy.itemIds.map((item) => <tr key={idOf(item)}>
          <td><strong>{item.itemCode || idOf(item).slice(-6)}</strong></td><td>{item.serialNumber || '—'}</td>
          <td>{labelOf(DISCREPANCY_CONDITION_LABELS, previous.get(idOf(item)), previous.get(idOf(item)) || '—')}</td>
          <td>{resolvedItemIds.has(idOf(item)) ? 'Đã kết luận' : 'Đang điều tra'}</td>
        </tr>) : <tr><td colSpan="4">Không có mã hàng.</td></tr>}
      </tbody></table></div>
    </>
    <h3 className="wm-discrepancy-heading">Lịch sử kết luận</h3>
    <div className="wm-table-wrap"><table><thead><tr><th>Thời điểm</th><th>Kết luận</th><th>Số lượng</th><th>Nơi nhập lại / bên chịu trách nhiệm</th><th>Ghi chú</th><th>Người kết luận</th></tr></thead><tbody>
      {(discrepancy.resolutions || []).length ? discrepancy.resolutions.map((row) => <tr key={row._id}>
        <td>{row.resolvedAt ? new Date(row.resolvedAt).toLocaleString('vi-VN') : '—'}</td>
        <td>{labelOf(DISCREPANCY_OUTCOME_LABELS, row.outcome, row.outcome)}</td>
        <td>{row.quantity}{row.itemIds?.length ? <ItemCodeGroup label="Mã hàng" items={row.itemIds} /> : null}</td>
        <td>{row.outcome === 'found'
          ? `${locationLabel(row.targetLocationId)}${row.targetStorageId ? ` / ${row.targetStorageId.code || ''}` : ''}`
          : labelOf(RESPONSIBLE_PARTY_LABELS, row.responsibleParty, '—')}</td>
        <td>{row.note || '—'}</td>
        <td>{row.resolvedBy?.FullName || '—'}</td>
      </tr>) : <tr><td colSpan="6">Chưa có kết luận nào.</td></tr>}
    </tbody></table></div>
  </div>;
}

/**
 * Nhãn chênh lệch trên dòng phiếu điều chuyển / phiếu trả. Bấm vào xem chi tiết chỉ đọc.
 * `discrepancy` là `line.discrepancyId` (đã populate code/status/quantityMissing/quantityResolved, hoặc chỉ là id).
 */
export function StockDiscrepancyBadge({ discrepancy, quantityMissing }) {
  const [show, setShow] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (!discrepancy) return null;
  const status = discrepancy.status || 'open';
  const missing = discrepancy.quantityMissing ?? quantityMissing ?? 0;
  const label = status === 'resolved' ? 'Đã xử lý' : `Thiếu ${missing} — ${status === 'partially_resolved' ? 'đã xử lý một phần' : 'đang điều tra'}`;
  const open = async () => {
    setShow(true); setLoading(true); setError('');
    try { setDetail(await stockDiscrepancyService.get(idOf(discrepancy))); }
    catch (loadError) { setError(loadError.status === 403 ? 'Bạn không có quyền xem phiếu chênh lệch này.' : loadError.message); }
    finally { setLoading(false); }
  };
  return <>
    <button type="button" className={`wm-status-badge wh-discrepancy-badge-button ${DISCREPANCY_STATUS_CLASS[status] || ''}`} onClick={open} title={discrepancy.discrepancyCode || 'Xem phiếu chênh lệch'}>{label}</button>
    <Modal show={show} onHide={() => setShow(false)} size="xl" centered scrollable>
      <Modal.Header closeButton><Modal.Title as="h5">Phiếu chênh lệch {detail?.discrepancyCode || discrepancy.discrepancyCode || ''}</Modal.Title></Modal.Header>
      <Modal.Body>
        {loading ? <p>Đang tải phiếu chênh lệch...</p> : error ? <div className="wm-error">{error}</div> : <StockDiscrepancyDetailBody discrepancy={detail} />}
      </Modal.Body>
      <Modal.Footer><Button variant="secondary" onClick={() => setShow(false)}>Đóng</Button></Modal.Footer>
    </Modal>
  </>;
}
