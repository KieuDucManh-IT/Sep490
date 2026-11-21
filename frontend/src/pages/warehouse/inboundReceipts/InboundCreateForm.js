import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Trash2 } from 'lucide-react';
import { VariantQuantityPicker, mergeQuantityLines } from '../../../components/warehouse';
import { formatVariantName } from '../../../constants/warehouseLabels';
import { codeAndName } from '../shared/slipHelpers';
import { buildCreatePayload, validateCreate } from './inboundHelpers';

/** Dòng mới từ picker; `variant` chỉ để hiển thị, buildCreatePayload chỉ lấy variantId / số lượng / giá. */
const lineFromPick = (pick) => ({ variantId: pick.variantId, variant: pick.variant, quantityExpected: pick.quantity, unitCost: '' });

function LineRow({ line, index, onChange, onRemove }) {
  return (
    <div className="wm-inbound-line wh-inbound-line">
      <div>
        <small>Sản phẩm / biến thể</small>
        <strong className="d-block">{formatVariantName(line.variant) || line.variantId}</strong>
      </div>
      <label>
        Số lượng dự kiến
        <input required type="number" min="1" step="1" value={line.quantityExpected}
          onChange={(event) => onChange(index, 'quantityExpected', event.target.value)} />
      </label>
      <label>
        Giá nhập / cái
        <input required type="number" min="0" step="1" value={line.unitCost}
          onChange={(event) => onChange(index, 'unitCost', event.target.value)} />
      </label>
      <button type="button" className="wm-icon-button danger" aria-label="Xóa dòng hàng" onClick={() => onRemove(index)}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

/**
 * Form tạo phiếu nhập từ nhà cung cấp (chủ kho). Kho nhận luôn là kho tổng duy nhất;
 * chọn sản phẩm một lần rồi nhập số lượng cho nhiều biến thể (VariantQuantityPicker, TASK-014 B);
 * biến thể đã có trong phiếu được cộng dồn. Payload tạo phiếu giữ nguyên.
 */
export default function InboundCreateForm({ centralLocation, suppliers, staff, onCreate, onClose }) {
  const [supplierId, setSupplierId] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateLine = (index, key, value) => {
    setLines((old) => old.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };
  const removeLine = (index) => setLines((old) => old.filter((_, i) => i !== index));
  const addPicked = (picked) => setLines((old) => mergeQuantityLines(old, picked, { quantityKey: 'quantityExpected', createLine: lineFromPick }));

  const submit = async (event) => {
    event.preventDefault();
    const form = { centralLocation, supplierId, assignedStaffId, note, lines };
    const message = lines.length ? validateCreate(form) : 'Hãy thêm ít nhất một mặt hàng vào phiếu.';
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate(buildCreatePayload(form));
      onClose();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Modal.Body className="wm-inbound-modal">
        {error && <div className="wm-error">{error}</div>}
        <div className="wm-form">
          <div className="wm-central-warehouse">
            <small>Kho nhận hàng (kho tổng)</small>
            <strong>{centralLocation ? codeAndName(centralLocation) : 'Chưa xác định duy nhất kho tổng'}</strong>
          </div>
          <label>
            Nhà cung cấp
            <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Chọn nhà cung cấp</option>
              {suppliers.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>{supplier.supplierCode} — {supplier.name}</option>
              ))}
            </select>
          </label>
          <label>
            Nhân viên kho được giao
            <select required value={assignedStaffId} onChange={(event) => setAssignedStaffId(event.target.value)}>
              <option value="">Chọn nhân viên</option>
              {staff.map((person) => (
                <option key={person._id} value={person._id}>{person.FullName} — {person.Email}</option>
              ))}
            </select>
          </label>
          <div className="wm-inbound-lines">
            <div className="wm-inbound-lines-heading">
              <strong>Mặt hàng dự kiến</strong>
              <small>{lines.length} dòng</small>
            </div>
            <VariantQuantityPicker
              onAdd={addPicked}
              existingLines={lines.map((line) => ({ variantId: line.variantId, quantity: line.quantityExpected }))}
            />
            {!lines.length && <small>Chưa có mặt hàng. Chọn sản phẩm, nhập số lượng từng biến thể rồi bấm "Thêm vào phiếu".</small>}
            {lines.map((line, index) => (
              <LineRow key={line.variantId} line={line} index={index} onChange={updateLine} onRemove={removeLine} />
            ))}
          </div>
          <label className="wm-full-row">
            Ghi chú
            <textarea maxLength={1000} rows="2" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onClose}>Hủy</Button>
        <Button variant="dark" type="submit" disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo phiếu nhập'}</Button>
      </Modal.Footer>
    </form>
  );
}
