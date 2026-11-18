import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { RELOCATION_TYPE_LABELS, labelOf } from '../../../constants/warehouseLabels';
import RelocationGroupEditor from './RelocationGroupEditor';
import { groupKey } from './relocationHelpers';

/**
 * Form tạo phiếu tách / gộp tồn (chủ kho): chọn nhân viên thực hiện, thêm hàng từ tồn kho,
 * rồi chỉnh kệ / số lượng cho từng mặt hàng. Modal được ẩn (không gỡ) khi mở bảng chọn hàng để giữ dữ liệu.
 */
export default function RelocationCreateModal({
  show, operationType, staff, assigned, setAssigned, groups, setGroups, shelves, shelfCode, error, busy,
  onPickGoods, onSubmit, onHide,
}) {
  const isSplit = operationType === 'split';
  const updateGroup = (index, group) => setGroups((old) => old.map((item, i) => (i === index ? group : item)));
  const removeGroup = (index) => setGroups((old) => old.filter((_, i) => i !== index));

  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable>
      <form onSubmit={onSubmit}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Tạo phiếu {labelOf(RELOCATION_TYPE_LABELS, operationType, '').toLowerCase()}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="wh-stack-form">
          {error && <div className="wm-error">{error}</div>}
          <label>
            Nhân viên kho
            <select required value={assigned} onChange={(event) => setAssigned(event.target.value)}>
              <option value="">Chọn nhân viên</option>
              {staff.map((member) => <option key={member._id} value={member._id}>{member.FullName}</option>)}
            </select>
          </label>
          <div>
            <Button variant="outline-secondary" onClick={onPickGoods}>+ Thêm hàng hóa</Button>
          </div>
          {groups.map((group, index) => (
            <RelocationGroupEditor
              key={groupKey(group, operationType)}
              group={group}
              isSplit={isSplit}
              shelves={shelves}
              shelfCode={shelfCode}
              onChange={(next) => updateGroup(index, next)}
              onRemove={() => removeGroup(index)}
            />
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Đóng</Button>
          <Button variant="dark" type="submit" disabled={!groups.length || busy}>Tạo và giao nhân viên</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
