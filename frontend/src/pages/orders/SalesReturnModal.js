import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, Modal, Spinner, Tab, Table, Tabs } from 'react-bootstrap';
import { ItemCodeGroup } from '../../components/warehouse';
import {
  SALES_RETURN_CONDITION_LABELS, SALES_RETURN_DISPOSITION_LABELS, formatVariantName, labelOf,
} from '../../constants/warehouseLabels';
import { createSalesReturn, getSalesReturnableItems, getSalesReturns } from '../../services/salesOrderApi';
import {
  buildReturnPayload, initialReturnLines, setReturnCount, toggleReturnItem, validateReturnForm,
} from './salesReturnRules';
import '../../components/warehouse/stackedModal.css';

const idOf = (value) => String(value?._id || value || '');
const codeOf = (item) => item?.itemCode || item?.serialNumber || idOf(item).slice(-6);

/** Một dòng đơn: số món trả (tự chọn món đầu danh sách), sửa món cụ thể, tình trạng, cách xử lý, ghi chú. */
function ReturnLine({ line, value, onChange }) {
  const items = line.items || [];
  const remaining = Number(line.quantity || 0) - Number(line.quantityReturned || 0);
  return (
    <div className="border rounded p-2 mb-2">
      <div className="d-flex justify-content-between flex-wrap gap-2">
        <strong>{formatVariantName(line.variant) || 'Mặt hàng'}</strong>
        <small className="text-muted">Đã mua {line.quantity} · đã trả {line.quantityReturned || 0} · còn trả được {items.length} món</small>
      </div>
      {items.length === 0 ? <small className="text-muted">Không còn món nào trả được (đã trả hết hoặc đơn bán trước khi quản lý theo món).</small> : (
        <>
          <div className="d-flex gap-2 align-items-end flex-wrap mt-2">
            <Form.Group>
              <Form.Label className="small mb-0">Số món trả</Form.Label>
              <Form.Control size="sm" type="number" min="0" max={Math.min(items.length, remaining)} style={{ width: 90 }}
                value={value.itemIds.length} onChange={(event) => onChange(setReturnCount(value, line, event.target.value))} />
            </Form.Group>
            <Form.Group>
              <Form.Label className="small mb-0">Tình trạng khi trả</Form.Label>
              <Form.Select size="sm" value={value.conditionOnReturn} onChange={(event) => onChange({ ...value, conditionOnReturn: event.target.value })}>
                {Object.entries(SALES_RETURN_CONDITION_LABELS).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label className="small mb-0">Cách xử lý</Form.Label>
              <Form.Select size="sm" value={value.disposition} onChange={(event) => onChange({ ...value, disposition: event.target.value })}>
                {Object.entries(SALES_RETURN_DISPOSITION_LABELS).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group className="flex-grow-1">
              <Form.Label className="small mb-0">Ghi chú</Form.Label>
              <Form.Control size="sm" maxLength={500} value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} />
            </Form.Group>
          </div>
          <div className="d-flex flex-wrap gap-3 mt-2">
            {items.map((item) => (
              <Form.Check key={idOf(item)} type="checkbox" id={`return-item-${idOf(item)}`} label={codeOf(item)}
                checked={value.itemIds.includes(idOf(item))}
                onChange={(event) => onChange(toggleReturnItem(value, idOf(item), event.target.checked))} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Danh sách phiếu trả đã ghi nhận của đơn. */
function ReturnHistory({ returns }) {
  if (!returns.length) return <p className="text-muted small mb-0">Đơn chưa có phiếu trả hàng.</p>;
  return (
    <Table size="sm" responsive className="mb-0">
      <thead><tr><th>Mã phiếu</th><th>Ngày</th><th>Lý do</th><th>Món trả</th><th>Người ghi nhận</th></tr></thead>
      <tbody>
        {returns.map((row) => (
          <tr key={row._id}>
            <td><strong>{row.returnCode}</strong><br /><Badge bg="secondary">{row.returnStatus === 'completed' ? 'Hoàn tất' : row.returnStatus}</Badge></td>
            <td>{row.createdAt ? new Date(row.createdAt).toLocaleString('vi-VN') : '—'}</td>
            <td>{row.returnReason}</td>
            <td>
              {(row.items || []).map((detail) => (
                <div key={detail._id} className="mb-1">
                  <ItemCodeGroup label={`${labelOf(SALES_RETURN_CONDITION_LABELS, detail.conditionOnReturn, detail.conditionOnReturn)} · ${labelOf(SALES_RETURN_DISPOSITION_LABELS, detail.disposition, detail.disposition)}`}
                    items={detail.itemIds || []} codeOf={codeOf} />
                </div>
              ))}
            </td>
            <td>{row.createdBy?.FullName || '—'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * Trả hàng bán theo món (TASK-015) cho Branch Manager, chỉ đơn đã hoàn tất.
 * Chọn món trong số món đã bán của đơn, tình trạng và cách xử lý; phiếu ghi nhận ngay, món về chi nhánh.
 * Không làm hoàn tiền.
 */
export default function SalesReturnModal({ order, show, onHide, onCreated }) {
  const orderId = order?._id;
  const [tab, setTab] = useState('create');
  const [returnable, setReturnable] = useState([]);
  const [returns, setReturns] = useState([]);
  const [lines, setLines] = useState({});
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const [returnableRes, returnsRes] = await Promise.all([getSalesReturnableItems(orderId), getSalesReturns(orderId)]);
      const nextReturnable = returnableRes?.data || [];
      setReturnable(nextReturnable);
      setLines(initialReturnLines(nextReturnable));
      setReturns(returnsRes?.data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!show) return;
    setReason('');
    setNotice('');
    load();
  }, [show, load]);

  const submit = async () => {
    const message = validateReturnForm(reason, lines);
    if (message) { setError(message); return; }
    setSaving(true);
    setError('');
    try {
      const res = await createSalesReturn(orderId, buildReturnPayload(reason, lines));
      setNotice(`Đã ghi nhận phiếu trả ${res?.data?.returnCode || ''}.`);
      setReason('');
      await load();
      setTab('history');
      onCreated?.();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = Object.values(lines).reduce((sum, value) => sum + value.itemIds.length, 0);

  return (
    <Modal show={show} onHide={saving ? undefined : onHide} size="lg" centered scrollable
      className="wm-transfer-stacked" backdropClassName="wm-transfer-stacked-backdrop">
      <Modal.Header closeButton={!saving}>
        <Modal.Title as="h5">Trả hàng · đơn {order?.orderCode || order?.code || ''}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
        {loading ? <div className="text-center py-4"><Spinner animation="border" size="sm" /> Đang tải...</div> : (
          <Tabs activeKey={tab} onSelect={(key) => setTab(key || 'create')} className="mb-3">
            <Tab eventKey="create" title="Tạo phiếu trả">
              <p className="small text-muted">
                Nhập số món khách trả (hệ thống tự chọn món, có thể bỏ / chọn lại từng mã). Món trả về kho chi nhánh của đơn:
                "Nhập lại kho" thì bán lại được; "Cách ly" / "Sửa chữa" / "Hủy bỏ" thì tạm không khả dụng để kho xử lý tiếp.
              </p>
              {returnable.map((line) => (
                <ReturnLine key={idOf(line.salesOrderDetailId)} line={line}
                  value={lines[idOf(line.salesOrderDetailId)] || { itemIds: [], conditionOnReturn: 'good', disposition: 'restock', note: '' }}
                  onChange={(value) => setLines((old) => ({ ...old, [idOf(line.salesOrderDetailId)]: value }))} />
              ))}
              {!returnable.length && <p className="text-muted small">Đơn không có dòng hàng nào.</p>}
              <Form.Group className="mt-2">
                <Form.Label>Lý do trả hàng <span className="text-danger">*</span></Form.Label>
                <Form.Control as="textarea" rows={2} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
              </Form.Group>
            </Tab>
            <Tab eventKey="history" title={`Phiếu trả của đơn (${returns.length})`}>
              <ReturnHistory returns={returns} />
            </Tab>
          </Tabs>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" disabled={saving} onClick={onHide}>Đóng</Button>
        {tab === 'create' && (
          <Button variant="dark" disabled={saving || loading || !selectedCount} onClick={submit}>
            {saving ? 'Đang lưu...' : `Ghi nhận trả ${selectedCount} món`}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
