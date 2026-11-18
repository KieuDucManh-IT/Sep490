import React, { useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

const MAX_REASON = 500;

/** Dòng thông tin "Đã hủy bởi … lúc … — Lý do: …" cho phiếu đã hủy. */
export function WarehouseCancelledNote({ slip }) {
  if (!slip || slip.status !== 'cancelled') return null;
  const who = slip.cancelledBy?.FullName || slip.cancelledBy?.Email || '';
  const when = slip.cancelledAt ? new Date(slip.cancelledAt).toLocaleString('vi-VN') : '';
  return <div className="wm-error" role="status">
    Đã hủy{who ? ` bởi ${who}` : ''}{when ? ` lúc ${when}` : ''}{slip.cancelReason ? ` — Lý do: ${slip.cancelReason}` : ''}
  </div>;
}

/**
 * Hộp thoại xác nhận hủy phiếu kho (điều chuyển, nhập kho, kiểm kê).
 * onConfirm(reason) trả về Promise; lỗi ném ra sẽ hiện trong modal.
 */
export default function WarehouseCancelSlipModal({ show, slipLabel = 'phiếu', slipCode = '', onHide, onConfirm }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) { setReason(''); setError(''); setSubmitting(false); }
  }, [show]);

  const trimmed = reason.trim();
  const submit = async (event) => {
    event?.preventDefault();
    if (!trimmed) { setError('Vui lòng nhập lý do hủy phiếu.'); return; }
    if (trimmed.length > MAX_REASON) { setError(`Lý do hủy tối đa ${MAX_REASON} ký tự.`); return; }
    setSubmitting(true); setError('');
    try {
      await onConfirm(trimmed);
    } catch (submitError) {
      setError(submitError?.message || 'Không thể hủy phiếu.');
    } finally {
      setSubmitting(false);
    }
  };

  return <Modal show={show} onHide={submitting ? undefined : onHide} centered backdrop={submitting ? 'static' : true}>
    <Form onSubmit={submit}>
      <Modal.Header closeButton={!submitting}>
        <Modal.Title as="h5">Hủy {slipLabel}{slipCode ? ` ${slipCode}` : ''}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">Phiếu sau khi hủy sẽ không thể tiếp tục xử lý. Tồn kho không thay đổi.</p>
        <Form.Group controlId="warehouse-cancel-reason">
          <Form.Label>Lý do hủy <span className="text-danger">*</span></Form.Label>
          <Form.Control as="textarea" rows={3} maxLength={MAX_REASON} value={reason} disabled={submitting} autoFocus onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do hủy phiếu" />
          <Form.Text muted>{trimmed.length}/{MAX_REASON} ký tự</Form.Text>
        </Form.Group>
        {error && <div className="alert alert-danger mt-3 mb-0 py-2">{error}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" disabled={submitting} onClick={onHide}>Không hủy</Button>
        <Button variant="danger" type="submit" disabled={submitting || !trimmed}>{submitting ? 'Đang hủy...' : 'Xác nhận hủy'}</Button>
      </Modal.Footer>
    </Form>
  </Modal>;
}
