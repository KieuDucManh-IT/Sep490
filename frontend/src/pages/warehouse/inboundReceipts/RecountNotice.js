import React from 'react';
import { Alert, Badge } from 'react-bootstrap';
import { formatDateTime } from '../shared/slipHelpers';

/** Nhãn ngắn "Kiểm nhận lại (lần n)" cho phiếu đang chờ nhân viên đếm lại; null nếu không phải. */
export const recountLabel = (receipt) => (
  receipt?.status === 'awaiting_receiving' && receipt?.recountCount > 0
    ? `Kiểm nhận lại (lần ${receipt.recountCount})`
    : ''
);

/** Khung báo phiếu bị quản lý kho yêu cầu kiểm nhận lại: số lần, lý do, người yêu cầu. */
export default function RecountNotice({ receipt }) {
  const label = recountLabel(receipt);
  if (!label) return null;
  return (
    <Alert variant="warning" className="mb-3">
      <Badge bg="warning" text="dark" className="me-2">{label}</Badge>
      <strong>Lý do:</strong> {receipt.recountReason || '—'}
      <div className="small mt-1">
        Yêu cầu bởi {receipt.lastRecountBy?.FullName || 'quản lý kho'}
        {receipt.lastRecountAt ? ` lúc ${formatDateTime(receipt.lastRecountAt)}` : ''}.
        {' '}Số đã nhận lần trước được điền sẵn, hãy đếm lại và sửa nếu cần.
      </div>
    </Alert>
  );
}
