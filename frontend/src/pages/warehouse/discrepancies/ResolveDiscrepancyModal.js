import React, { useMemo, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import WarehouseItemChecklist from '../../../components/WarehouseItemChecklist';
import { unresolvedItems, discrepancyVariantLabel } from '../../../components/StockDiscrepancyDetail';
import { RESPONSIBLE_PARTY_LABELS } from '../../../constants/warehouseLabels';
import { codeAndName, idOf } from '../shared/slipHelpers';
import {
  buildResolvePayload, emptyResolveForm, isIndividualDiscrepancy, permissionMessage, remainingQuantity,
  targetOptions, validateResolveForm,
} from './discrepancyHelpers';

function AmountField({ discrepancy, form, setForm, remaining }) {
  const candidates = useMemo(() => unresolvedItems(discrepancy), [discrepancy]);
  if (isIndividualDiscrepancy(discrepancy)) {
    const toggle = (itemId, checked) => setForm((old) => ({
      ...old,
      itemIds: checked ? [...old.itemIds, itemId] : old.itemIds.filter((id) => id !== itemId),
    }));
    return (
      <Form.Group className="mb-3">
        <Form.Label>Chọn món hàng</Form.Label>
        <WarehouseItemChecklist
          items={candidates}
          selectedIds={form.itemIds}
          maxSelectable={remaining}
          onToggle={toggle}
          emptyMessage="Không còn món nào đang điều tra."
        />
      </Form.Group>
    );
  }
  return (
    <Form.Group className="mb-3" controlId="discrepancy-quantity">
      <Form.Label>Số lượng</Form.Label>
      <Form.Control
        type="number"
        min="1"
        max={remaining}
        step="1"
        value={form.quantity}
        onChange={(event) => setForm({ ...form, quantity: event.target.value })}
      />
      <Form.Text muted>Tối đa {remaining}.</Form.Text>
    </Form.Group>
  );
}

function FoundFields({ form, setForm, options, shelves }) {
  return (
    <>
      <Form.Group className="mb-3" controlId="discrepancy-target">
        <Form.Label>Nơi nhập lại</Form.Label>
        <Form.Select
          value={form.target}
          onChange={(event) => setForm({ ...form, target: event.target.value, targetStorageId: '' })}
        >
          <option value="">Chọn nơi nhập lại</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Form.Select>
      </Form.Group>
      {form.target === 'central' && (
        <Form.Group className="mb-3" controlId="discrepancy-shelf">
          <Form.Label>Kệ trong kho tổng</Form.Label>
          <Form.Select
            value={form.targetStorageId}
            onChange={(event) => setForm({ ...form, targetStorageId: event.target.value })}
          >
            <option value="">Chọn kệ</option>
            {shelves.map((shelf) => <option key={shelf._id} value={shelf._id}>{codeAndName(shelf)}</option>)}
          </Form.Select>
        </Form.Group>
      )}
    </>
  );
}

function LostFields({ form, setForm }) {
  return (
    <Form.Group className="mb-3" controlId="discrepancy-responsible">
      <Form.Label>Bên chịu trách nhiệm</Form.Label>
      <Form.Select
        value={form.responsibleParty}
        onChange={(event) => setForm({ ...form, responsibleParty: event.target.value })}
      >
        <option value="">Chọn bên chịu trách nhiệm</option>
        {Object.entries(RESPONSIBLE_PARTY_LABELS).map(([value, text]) => (
          <option key={value} value={value}>{text}</option>
        ))}
      </Form.Select>
    </Form.Group>
  );
}

function initialForm(discrepancy, centralId) {
  const originalIsCentral = idOf(discrepancy.toLocationId) === centralId;
  return { ...emptyResolveForm(), target: originalIsCentral ? 'central' : '' };
}

/**
 * Form kết luận một phần (hoặc toàn bộ) phiếu chênh lệch: tìm thấy → nhập lại kho; mất → ghi bên chịu trách nhiệm.
 * `onResolved(updated)` khi lưu thành công; `onConflict()` khi gặp 409 để trang tải lại dữ liệu.
 */
export default function ResolveDiscrepancyModal({ discrepancy, centralId, shelves, onHide, onSubmit, onConflict }) {
  const [form, setForm] = useState(() => initialForm(discrepancy, centralId));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const remaining = remainingQuantity(discrepancy);
  const validationMessage = validateResolveForm(discrepancy, form, centralId);

  const submit = async (event) => {
    event.preventDefault();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await onSubmit(buildResolvePayload(discrepancy, form, centralId));
    } catch (submitError) {
      setFormError(permissionMessage(submitError));
      // Phiếu vừa được kết luận ở nơi khác hoặc kệ hết chỗ: tải lại để thấy trạng thái mới.
      if (submitError.status === 409) await onConflict();
    } finally {
      setSubmitting(false);
    }
  };

  const shownMessage = formError || validationMessage;

  return (
    <Modal show onHide={submitting ? undefined : onHide} size="lg" centered scrollable backdrop={submitting ? 'static' : true}>
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!submitting}>
          <Modal.Title as="h5">Kết luận phiếu {discrepancy.discrepancyCode}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            {discrepancyVariantLabel(discrepancy)} · còn <strong>{remaining}</strong> đang điều tra
          </p>
          <Form.Group className="mb-3">
            <Form.Label>Kết luận</Form.Label>
            <div>
              <Form.Check inline type="radio" id="discrepancy-outcome-found" name="discrepancy-outcome" label="Tìm thấy"
                checked={form.outcome === 'found'} onChange={() => setForm({ ...form, outcome: 'found' })} />
              <Form.Check inline type="radio" id="discrepancy-outcome-lost" name="discrepancy-outcome" label="Mất"
                checked={form.outcome === 'lost'} onChange={() => setForm({ ...form, outcome: 'lost' })} />
            </div>
          </Form.Group>
          <AmountField discrepancy={discrepancy} form={form} setForm={setForm} remaining={remaining} />
          {form.outcome === 'found' && (
            <FoundFields form={form} setForm={setForm} options={targetOptions(discrepancy, centralId)} shelves={shelves} />
          )}
          {form.outcome === 'lost' && <LostFields form={form} setForm={setForm} />}
          <Form.Group controlId="discrepancy-note">
            <Form.Label>
              Ghi chú
              {form.outcome === 'lost' ? <span className="text-danger"> *</span> : ' (không bắt buộc)'}
            </Form.Label>
            <Form.Control as="textarea" rows={3} maxLength={1000} value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </Form.Group>
          {shownMessage && (
            <div className={`alert ${formError ? 'alert-danger' : 'alert-secondary'} mt-3 mb-0 py-2`}>{shownMessage}</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" type="button" disabled={submitting} onClick={onHide}>Quay lại</Button>
          <Button variant="dark" type="submit" disabled={submitting || Boolean(validationMessage)}>
            {submitting ? 'Đang lưu...' : 'Xác nhận kết luận'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
