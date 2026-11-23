import React, { useMemo, useState } from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { RECEIPT_STATE_LABELS } from '../../constants/warehouseLabels';
import { allowedReceiptStates, itemCodeOf, receiptCounts, receiptStateOf, setReceiptState } from './itemSelectionRules';
import './stackedModal.css';

const idOf = (value) => String(value?._id || value || '');

/**
 * Modal đánh dấu món cần xử lý / mất khi nhận hàng theo món (TASK-016: Đạt / Cần xử lý / Mất).
 * Mặc định mọi món "Đạt"; người dùng chỉ đổi món khác thường. Có ô lọc theo mã.
 * @param {object} props
 * @param {string} props.title tên dòng hàng
 * @param {object[]} props.items món đã xuất (có itemCode)
 * @param {{ receivedItemIds: string[], damagedItemIds: string[] }} props.entry kết quả nhận hiện tại
 * @param {{ receivedIds?: string[], damagedIds?: string[] }} [props.previous] đã ghi nhận lần trước (không được bỏ)
 * @param {(entry: object) => void} props.onChange
 * @param {() => void} props.onHide
 */
export default function ItemReceiptModal({ title, items = [], entry, previous, onChange, onHide }) {
  const [query, setQuery] = useState('');
  const [onlyUnusual, setOnlyUnusual] = useState(false);
  const counts = receiptCounts(entry, items.length);
  const visible = useMemo(() => items.filter((item) => {
    const text = [item.itemCode, item.serialNumber].filter(Boolean).join(' ').toLowerCase();
    if (query && !text.includes(query.trim().toLowerCase())) return false;
    return !onlyUnusual || receiptStateOf(entry, idOf(item)) !== 'good';
  }), [items, query, onlyUnusual, entry]);

  return <Modal show onHide={onHide} centered size="lg" className="wm-transfer-stacked" backdropClassName="wm-transfer-stacked-backdrop">
    <Modal.Header closeButton>
      <div>
        <small className="text-muted">Đánh dấu món cần xử lý / mất</small>
        <Modal.Title as="h5">{title}</Modal.Title>
        <small>Đạt {counts.good} · Cần xử lý {counts.damaged} · Mất {counts.missing}</small>
      </div>
    </Modal.Header>
    <Modal.Body>
      <div className="d-flex gap-3 align-items-center mb-2 flex-wrap">
        <Form.Control size="sm" style={{ maxWidth: 280 }} placeholder="Lọc theo mã hàng..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <Form.Check type="switch" id="receipt-only-unusual" label="Chỉ hiện món cần xử lý / mất" checked={onlyUnusual} onChange={(event) => setOnlyUnusual(event.target.checked)} />
      </div>
      <Table size="sm" hover responsive className="mb-0">
        <thead><tr><th>Mã hàng</th><th>Kết quả nhận</th></tr></thead>
        <tbody>
          {visible.map((item) => {
            const itemId = idOf(item);
            const allowed = allowedReceiptStates(itemId, previous);
            return <tr key={itemId}>
              <td><strong>{itemCodeOf(item)}</strong>{item.serialNumber && <small className="wm-stock-subline">{item.serialNumber}</small>}</td>
              <td>
                <Form.Select size="sm" aria-label="Kết quả nhận" value={receiptStateOf(entry, itemId)}
                  onChange={(event) => onChange(setReceiptState(entry, itemId, event.target.value))}>
                  {allowed.map((state) => <option key={state} value={state}>{RECEIPT_STATE_LABELS[state]}</option>)}
                </Form.Select>
              </td>
            </tr>;
          })}
          {!visible.length && <tr><td colSpan={2} className="text-center text-muted">Không có món khớp bộ lọc.</td></tr>}
        </tbody>
      </Table>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="dark" onClick={onHide}>Xong</Button>
    </Modal.Footer>
  </Modal>;
}
