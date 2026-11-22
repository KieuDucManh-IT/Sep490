import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import RecountNotice from './RecountNotice';
import { buildReceivePayload, initialReceiveLines, lineName, validateReceive } from './inboundHelpers';

/** Nhân viên kho ghi số lượng thực nhận, số hỏng và ghi chú cho từng dòng phiếu nhập. */
export default function InboundReceiveForm({ receipt, onReceive, onBack, onDone }) {
  const [lines, setLines] = useState(() => initialReceiveLines(receipt));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (index, key, value) => {
    setLines((old) => old.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const submit = async (event) => {
    event.preventDefault();
    const message = validateReceive(lines);
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onReceive(buildReceivePayload(lines));
      onDone();
    } catch (receiveError) {
      setError(receiveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Modal.Body className="wm-receive-list">
        <RecountNotice receipt={receipt} />
        {error && <div className="wm-error">{error}</div>}
        <p>Mặc định nhận đủ số dự kiến và không có hàng hỏng; chỉ sửa dòng nhận thiếu hoặc có hàng hỏng.</p>
        {receipt.items.map((item, index) => (
          <div className="wm-receive-row" key={item._id}>
            <strong>{lineName(item)} <small>Dự kiến: {item.quantityExpected}</small></strong>
            <label>
              Thực nhận
              <input required type="number" min="0" step="1" value={lines[index]?.quantityReceived ?? ''}
                onChange={(event) => update(index, 'quantityReceived', event.target.value)} />
            </label>
            <label>
              Hỏng
              <input required type="number" min="0" step="1" value={lines[index]?.quantityDamaged ?? 0}
                onChange={(event) => update(index, 'quantityDamaged', event.target.value)} />
            </label>
            <label>
              Ghi chú
              <input value={lines[index]?.note || ''} onChange={(event) => update(index, 'note', event.target.value)} />
            </label>
          </div>
        ))}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onBack}>Quay lại</Button>
        <Button variant="dark" type="submit" disabled={saving}>{saving ? 'Đang gửi...' : 'Xác nhận đã nhận hàng'}</Button>
      </Modal.Footer>
    </form>
  );
}
