import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Plus, Trash2 } from 'lucide-react';
import { ProductVariantPicker } from '../../../components/warehouse';
import { codeAndName } from '../shared/slipHelpers';
import { buildCreatePayload, emptyLine, validateCreate } from './inboundHelpers';

function LineRow({ line, index, lines, onChange, onRemove }) {
  return (
    <div className="wm-inbound-line wh-inbound-line">
      <label>
        Sản phẩm / biến thể
        <ProductVariantPicker
          value={line.variantId}
          onChange={(variantId) => onChange(index, 'variantId', variantId)}
        />
      </label>
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
      {lines.length > 1 && (
        <button type="button" className="wm-icon-button danger" aria-label="Xóa dòng hàng" onClick={() => onRemove(index)}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

/**
 * Form tạo phiếu nhập từ nhà cung cấp (chủ kho). Kho nhận luôn là kho tổng duy nhất;
 * mỗi dòng chọn thẳng biến thể bằng một ô tìm theo tên hoặc SKU.
 */
export default function InboundCreateForm({ centralLocation, suppliers, staff, onCreate, onClose }) {
  const [supplierId, setSupplierId] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateLine = (index, key, value) => {
    setLines((old) => old.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };
  const removeLine = (index) => setLines((old) => old.filter((_, i) => i !== index));

  const submit = async (event) => {
    event.preventDefault();
    const form = { centralLocation, supplierId, assignedStaffId, note, lines };
    const message = validateCreate(form);
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
              <button type="button" className="secondary" onClick={() => setLines((old) => [...old, emptyLine()])}>
                <Plus size={14} />Thêm dòng
              </button>
            </div>
            {lines.map((line, index) => (
              <LineRow key={index} line={line} index={index} lines={lines} onChange={updateLine} onRemove={removeLine} />
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
