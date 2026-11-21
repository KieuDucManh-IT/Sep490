import React, { useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import '../../styles/WarehouseShared.css';

function errorText(error) {
  if (error?.status === 403) return error.message || 'Bạn không có quyền thực hiện thao tác này.';
  return error?.message || 'Không thể thực hiện thao tác.';
}

function resolveReasonMode(reasonMode, withReason) {
  if (reasonMode) return reasonMode;
  if (withReason) return 'optional';
  return 'none';
}

/**
 * Modal xác nhận thao tác (duyệt, hủy, bắt đầu...), có ô lý do tùy chọn hoặc bắt buộc.
 * Khi `onConfirm` ném lỗi, modal giữ nguyên và hiện lỗi; trang tự đóng modal khi thành công.
 * @param {object} props
 * @param {boolean} [props.show=true] hiện modal (có thể để trang tự render có điều kiện)
 * @param {React.ReactNode} props.title tiêu đề
 * @param {React.ReactNode} [props.body] nội dung giải thích
 * @param {string} [props.confirmText='Xác nhận'] chữ trên nút xác nhận
 * @param {string} [props.cancelText='Đóng'] chữ trên nút đóng
 * @param {string} [props.variant='dark'] màu nút xác nhận (react-bootstrap), ví dụ 'danger'
 * @param {'none'|'optional'|'required'} [props.reasonMode] có ô lý do hay không, bắt buộc hay không
 * @param {boolean} [props.withReason] cách viết cũ, tương đương reasonMode='optional'
 * @param {string} [props.reasonLabel] nhãn ô lý do
 * @param {string} [props.reasonPlaceholder] gợi ý trong ô lý do
 * @param {() => void} props.onHide đóng modal
 * @param {(reason: string) => Promise<void>|void} props.onConfirm xử lý khi bấm xác nhận, nhận lý do đã trim
 */
export default function ConfirmModal({
  show = true,
  title,
  body,
  confirmText = 'Xác nhận',
  cancelText = 'Đóng',
  variant = 'dark',
  reasonMode,
  withReason = false,
  reasonLabel,
  reasonPlaceholder,
  onHide,
  onConfirm,
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const mode = resolveReasonMode(reasonMode, withReason);
  const reasonRequired = mode === 'required';
  const showReason = mode !== 'none';
  const label = reasonLabel || (reasonRequired ? 'Lý do' : 'Lý do (không bắt buộc)');
  const canSubmit = !submitting && (!reasonRequired || reason.trim().length > 0);

  useEffect(() => {
    if (!show) return;
    setReason('');
    setError('');
  }, [show]);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason.trim());
    } catch (confirmError) {
      setError(errorText(confirmError));
    } finally {
      setSubmitting(false);
    }
  };

  const hide = submitting ? undefined : onHide;

  return (
    <Modal show={show} onHide={hide} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!submitting}>
          <Modal.Title as="h5">{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {body}
          {showReason && (
            <Form.Group className="mt-3">
              <Form.Label>
                {label}
                {reasonRequired && <span className="wh-required-mark"> *</span>}
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                maxLength={1000}
                value={reason}
                required={reasonRequired}
                placeholder={reasonPlaceholder}
                disabled={submitting}
                onChange={(event) => setReason(event.target.value)}
              />
            </Form.Group>
          )}
          {error && <div className="alert alert-danger wh-confirm-error mb-0 py-2">{error}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" type="button" disabled={submitting} onClick={onHide}>
            {cancelText}
          </Button>
          <Button variant={variant} type="submit" disabled={!canSubmit}>
            {submitting ? 'Đang xử lý...' : confirmText}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
