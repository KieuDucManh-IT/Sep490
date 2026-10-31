import React from 'react';
import { Modal, Spinner } from 'react-bootstrap';
import { Trash2, AlertTriangle, Building2, MapPin } from 'lucide-react';

export default function DeleteBranchModal({
  show,
  onHide,
  branch,
  onConfirm,
  deleting,
}) {
  if (!branch) return null;

  const isHQ = Boolean(branch.isHQ);

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop="static"
      keyboard={false}
      dialogClassName="vestora-modal-dialog"
    >
      <div className="vestora-modal-header delete-header">
        <div className="modal-header-brand-wrap">
          <div className="modal-header-icon-badge danger">
            <Trash2 size={20} />
          </div>
          <div>
            <h5 className="modal-title-main text-danger">Xác Nhận Xóa Chi Nhánh</h5>
            <p className="modal-subtitle-text">
              Thao tác này sẽ lưu trữ và ẩn chi nhánh khỏi mạng lưới hoạt động
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={onHide}
          disabled={deleting}
          aria-label="Đóng"
        />
      </div>

      <div className="vestora-modal-body">
        {/* Ràng buộc bất biến: Không cho phép xóa Trụ sở chính */}
        {isHQ ? (
          <div className="alert alert-danger d-flex align-items-start gap-2 mb-3">
            <AlertTriangle size={20} className="flex-shrink-0 mt-1" />
            <div>
              <div className="fw-bold">Không thể xóa Trụ sở chính!</div>
              <div className="small">
                Hệ thống yêu cầu toàn chuỗi thời trang VESTORA phải có tối thiểu và duy nhất 1 Trụ sở chính.
                Để xóa chi nhánh này, bạn cần chỉ định một chi nhánh khác làm Trụ sở chính trước.
              </div>
            </div>
          </div>
        ) : (
          <div className="alert alert-warning d-flex align-items-start gap-2 mb-3">
            <AlertTriangle size={20} className="flex-shrink-0 mt-1" />
            <div>
              <div className="fw-bold">Cảnh báo an toàn dữ liệu:</div>
              <div className="small">
                Bạn có chắc chắn muốn xóa chi nhánh này không? Thao tác này sẽ hủy liên kết Quản lý chi nhánh
                hiện tại và tạm ngưng toàn bộ giao dịch tại điểm bán này.
              </div>
            </div>
          </div>
        )}

        <div className="p-3 border rounded-3 bg-light mb-2">
          <div className="d-flex align-items-center gap-2 mb-2">
            <Building2 size={16} className="text-secondary" />
            <span className="fw-bold text-dark">{branch.name}</span>
            {isHQ && <span className="badge bg-danger ms-auto">TRỤ SỞ CHÍNH</span>}
          </div>

          <div className="d-flex align-items-start gap-2 text-muted small">
            <MapPin size={14} className="mt-1 flex-shrink-0" />
            <span>
              {[branch.address, branch.ward, branch.city].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ'}
            </span>
          </div>

          {branch.managerId && (
            <div className="mt-2 pt-2 border-top small text-muted">
              <span>Quản lý phụ trách hiện tại: </span>
              <strong className="text-dark">
                {branch.managerId.FullName || branch.managerId.Email || 'Quản lý chi nhánh'}
              </strong>
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn-modal-secondary"
          onClick={onHide}
          disabled={deleting}
        >
          Hủy Bỏ
        </button>

        <button
          type="button"
          className="btn-modal-danger"
          onClick={onConfirm}
          disabled={deleting || isHQ}
        >
          {deleting ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              <span>Đang xóa...</span>
            </>
          ) : (
            <>
              <Trash2 size={14} className="me-1" />
              <span>Xác Nhận Xóa</span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
