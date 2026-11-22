import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Row } from 'react-bootstrap';
import { KpiCards, PageHeader } from '../../components/warehouse';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import WarehousePageLayout from './shared/WarehousePageLayout';

const toForm = (warehouse) => ({
  name: warehouse?.name || '',
  address: warehouse?.address || '',
  maxCapacity: warehouse?.maxCapacity ?? '',
  note: warehouse?.note || '',
});

/** Lỗi ngay trên form trước khi gửi: sức chứa là số nguyên dương, không nhỏ hơn số đang chứa. */
const validate = (form, currentQuantity) => {
  if (!form.name.trim()) return 'Vui lòng nhập tên kho.';
  const capacity = Number(form.maxCapacity);
  if (form.maxCapacity === '' || !Number.isInteger(capacity) || capacity <= 0) return 'Sức chứa tối đa phải là số nguyên dương.';
  if (capacity < currentQuantity) return `Sức chứa tối đa không được nhỏ hơn số lượng đang chứa (${currentQuantity} cái).`;
  return '';
};

/**
 * "Thiết lập kho tổng" (TASK-014 A1): Quản lý kho chỉ sửa thông tin kho tổng duy nhất.
 * Mã kho và loại kho chỉ đọc; không tạo / xóa kho, không quản lý kho chi nhánh ở đây.
 * @param {object} props
 * @param {boolean} [props.readOnly] nhân viên kho chỉ xem
 */
export default function CentralWarehouseSettingsPage({ readOnly = false }) {
  const [warehouse, setWarehouse] = useState(null);
  const [form, setForm] = useState(toForm(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inventoryLocationService.central();
      setWarehouse(data);
      setForm(toForm(data));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentQuantity = Number(warehouse?.currentQuantity) || 0;
  const set = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setNotice('');
    const message = validate(form, currentQuantity);
    if (message) { setError(message); return; }
    setSaving(true);
    setError('');
    try {
      await inventoryLocationService.update(warehouse._id, {
        name: form.name.trim(),
        address: form.address.trim(),
        maxCapacity: Number(form.maxCapacity),
        note: form.note.trim(),
      });
      setNotice('Đã lưu thông tin kho tổng.');
      await load();
    } catch (saveError) {
      setError(saveError.message);
      if (saveError?.status === 409) await load();
    } finally {
      setSaving(false);
    }
  };

  const capacity = Number(warehouse?.maxCapacity) || 0;
  const percent = capacity ? Math.round((currentQuantity / capacity) * 100) : null;

  return (
    <WarehousePageLayout>
      <PageHeader
        eyebrow="KHO TỔNG / DANH MỤC DÙNG CHUNG"
        title="Thiết lập kho tổng"
        description="Thông tin kho tổng duy nhất của hệ thống. Kho chi nhánh do quản trị viên quản lý."
      />
      {error && <Alert variant="danger">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {loading && <div className="wm-tree-empty">Đang tải thông tin kho tổng...</div>}
      {!loading && warehouse && (
        <>
          <KpiCards items={[
            { key: 'current', label: 'Đang chứa', value: currentQuantity, unit: 'cái' },
            { key: 'capacity', label: 'Sức chứa tối đa', value: warehouse.maxCapacity ?? '—', unit: warehouse.maxCapacity ? 'cái' : '' },
            { key: 'percent', label: 'Đã dùng', value: percent == null ? '—' : `${percent}%`, tone: percent > 95 ? 'danger' : percent >= 80 ? 'warn' : 'default' },
          ]} />
          <section className="wm-panel">
            <Form onSubmit={submit}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group controlId="central-code">
                    <Form.Label>Mã kho</Form.Label>
                    <Form.Control readOnly plaintext value={warehouse.code || '—'} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="central-type">
                    <Form.Label>Loại kho</Form.Label>
                    <Form.Control readOnly plaintext value="Kho tổng" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="central-name">
                    <Form.Label>Tên kho</Form.Label>
                    <Form.Control required maxLength={160} value={form.name} onChange={set('name')} disabled={readOnly} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="central-capacity">
                    <Form.Label>Sức chứa tối đa (cái)</Form.Label>
                    <Form.Control required type="number" min={Math.max(1, currentQuantity)} step="1"
                      value={form.maxCapacity} onChange={set('maxCapacity')} disabled={readOnly} />
                    <Form.Text>Không nhỏ hơn số đang chứa ({currentQuantity} cái).</Form.Text>
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group controlId="central-address">
                    <Form.Label>Địa chỉ</Form.Label>
                    <Form.Control maxLength={500} value={form.address} onChange={set('address')} disabled={readOnly} />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group controlId="central-note">
                    <Form.Label>Ghi chú</Form.Label>
                    <Form.Control as="textarea" rows={3} maxLength={1000} value={form.note} onChange={set('note')} disabled={readOnly} />
                  </Form.Group>
                </Col>
              </Row>
              {!readOnly && (
                <div className="d-flex justify-content-end gap-2 mt-3">
                  <Button variant="outline-secondary" type="button" disabled={saving} onClick={() => setForm(toForm(warehouse))}>Hoàn tác</Button>
                  <Button variant="dark" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
                </div>
              )}
            </Form>
          </section>
        </>
      )}
    </WarehousePageLayout>
  );
}
