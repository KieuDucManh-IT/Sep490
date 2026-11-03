import React, { useState, useId, useEffect } from 'react';
import { Modal, Form, Spinner } from 'react-bootstrap';
import { Plus, Sparkles, FileText, CheckCircle2 } from 'lucide-react';

export default function CreatePolicyModal({ show, onHide, onCreate, isCreating }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [validationError, setValidationError] = useState('');

  const modalTitleId = useId();

  // Reset form khi modal mở
  useEffect(() => {
    if (show) {
      setTitle('');
      setSummary('');
      setContent('');
      setIsActive(true);
      setValidationError('');
    }
  }, [show]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError('Vui lòng nhập tên chính sách.');
      return;
    }

    onCreate({
      title: title.trim(),
      summary: summary.trim(),
      content: content.trim(),
      isActive,
    });
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      size="lg"
      backdrop="static"
      aria-labelledby={modalTitleId}
      className="owner-policy-create-modal"
    >
      <div className="modal-header border-bottom px-4 py-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="policy-editor-icon-box" aria-hidden="true" style={{ width: 40, height: 40 }}>
            <Plus size={20} />
          </div>
          <div>
            <h2 id={modalTitleId} className="h5 mb-0 fw-bold text-dark">
              Tạo Chính Sách Mới
            </h2>
            <small className="text-muted">
              Bổ sung quy chuẩn điều khoản hoạt động áp dụng cho toàn chuỗi VESTORA
            </small>
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={onHide}
          aria-label="Đóng cửa sổ"
          disabled={isCreating}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body p-4">
          {validationError ? (
            <div className="alert alert-danger py-2 px-3 mb-3 small" role="alert">
              ⚠️ {validationError}
            </div>
          ) : null}

          {/* 1. Tên chính sách */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label htmlFor="modal-policy-title" className="form-label fw-semibold mb-0 small text-dark">
                Tên chính sách <span className="text-danger">*</span>
              </label>
              <span className="small text-muted">{title.length}/200</span>
            </div>
            <input
              id="modal-policy-title"
              type="text"
              className="form-control"
              maxLength={200}
              placeholder="Ví dụ: Chính Sách Khách Hàng Thân Thiết, Chính Sách Đặt Cọc May Đo..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (validationError) setValidationError('');
              }}
              required
              autoFocus
            />
          </div>

          {/* 2. Tóm tắt cốt lõi (Summary) */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label htmlFor="modal-policy-summary" className="form-label fw-semibold mb-0 small text-dark d-flex align-items-center gap-1">
                <Sparkles size={14} className="text-gold" />
                <span>Tóm tắt nổi bật (Tùy chọn)</span>
              </label>
              <span className="small text-muted">{summary.length}/500</span>
            </div>
            <textarea
              id="modal-policy-summary"
              rows={2}
              maxLength={500}
              className="form-control"
              placeholder="Tóm tắt ngắn gọn 1-2 câu điểm mấu chốt của chính sách này..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* 3. Nội dung chi tiết */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label htmlFor="modal-policy-content" className="form-label fw-semibold mb-0 small text-dark d-flex align-items-center gap-1">
                <FileText size={14} className="text-gold" />
                <span>Nội dung điều khoản chi tiết</span>
              </label>
              <span className="small text-muted">Hỗ trợ đánh số (1., 2.) và gạch đầu dòng (-)</span>
            </div>
            <textarea
              id="modal-policy-content"
              rows={6}
              className="form-control"
              placeholder="1. Điều Kiện Áp Dụng&#10;- Điều khoản 1&#10;- Điều khoản 2&#10;&#10;2. Quyền Lợi & Nghĩa Vụ&#10;- Quyền lợi khách hàng..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* 4. Công tắc Trạng thái hiển thị */}
          <div className="d-flex align-items-center justify-content-between p-3 rounded bg-light border">
            <div>
              <span className="fw-semibold d-block text-dark small">Hiển thị cho khách hàng</span>
              <small className="text-muted">
                Bật để khách hàng có thể đọc chính sách này trên Cổng Khách Hàng.
              </small>
            </div>
            <Form.Check
              type="switch"
              id="modal-policy-isactive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="m-0 fs-5"
            />
          </div>
        </div>

        <div className="modal-footer border-top px-4 py-3 bg-light d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary px-3"
            onClick={onHide}
            disabled={isCreating}
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            className="btn btn-dark px-4 d-inline-flex align-items-center gap-2"
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Spinner size="sm" animation="border" />
                <span>Đang tạo...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Tạo Chính Sách</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
