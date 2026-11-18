import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import RelocationLinesEditor from './RelocationLinesEditor';

/**
 * Form tạo phiếu di chuyển hàng giữa các kệ (chủ kho): chọn nhân viên thực hiện, thêm hàng từ kệ nguồn,
 * chọn kệ đích và số lượng cho từng dòng. Modal được ẩn (không gỡ) khi mở bảng chọn hàng để giữ dữ liệu.
 * Hàng quản lý theo mã: hệ thống tự giữ các món cũ nhất ở kệ nguồn khi tạo phiếu (như trước).
 */
export default function RelocationCreateModal({
  show, staff, assigned, setAssigned, lines, setLines, shelves, error, busy, onPickGoods, onSubmit, onHide,
}) {
  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable>
      <form onSubmit={onSubmit}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Tạo phiếu di chuyển hàng</Modal.Title>
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
            <Button variant="outline-secondary" onClick={onPickGoods}>+ Thêm hàng từ kệ nguồn</Button>
            <small className="wm-stock-subline">
              Tách một kệ ra nhiều kệ: “+ Kệ đích khác”. Gộp nhiều kệ về một kệ: chọn hàng ở các kệ nguồn,
              chọn kệ đích ở một dòng rồi “Dùng kệ đích này cho mọi kệ nguồn”.
            </small>
          </div>
          <RelocationLinesEditor lines={lines} setLines={setLines} shelves={shelves} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Đóng</Button>
          <Button variant="dark" type="submit" disabled={!lines.length || busy}>Tạo và giao nhân viên</Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
