import React, { useState, useId, useEffect, useRef, memo } from 'react';
import { Modal, Form, Spinner } from 'react-bootstrap';
import { Plus, Sparkles, FileText, CheckCircle2, AlertCircle } from 'lucide-react';


function CreatePolicyModal({ show, onHide, onCreate, isCreating }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [validationError, setValidationError] = useState('');

  const modalTitleId = useId();
  const titleInputRef = useRef(null);

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

  const handleEntered = () => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  };

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
      onEntered={handleEntered}
      centered
      backdrop="static"
      keyboard={!isCreating}
      aria-labelledby={modalTitleId}
      dialogClassName="vestora-modal-dialog policy-create-modal-dialog"
    >
      {/* 1. Modal Header chuẩn Vestora */}
      <div className="vestora-modal-header">
        <div className="modal-header-brand-wrap">
          <div className="modal-header-icon-badge gold" aria-hidden="true">
            <Plus size={20} />
          </div>
          <div>
            <h5 id={modalTitleId} className="modal-title-main">
              Tạo Chính Sách Mới
            </h5>
            <p className="modal-subtitle-text">
              Thiết lập quy chuẩn điều khoản hoạt động áp dụng thống nhất cho toàn chuỗi VESTORA
            </p>
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

      <form id="create-policy-form" onSubmit={handleSubmit}>
        {/* 2. Modal Body với thẻ section chuẩn Vestora */}
        <div className="vestora-modal-body">
          {validationError ? (
            <div className="alert alert-danger py-2 px-3 mb-3 d-flex align-items-center gap-2 small" role="alert">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          ) : null}

          {/* Section 1: Thông tin nhận diện chính sách */}
          <div className="modal-section-card mb-3">
            <div className="modal-section-header">
              <span className="modal-section-title">
                <FileText size={14} className="text-gold" aria-hidden="true" />
                <span>1. Thông Tin Nhận Diện Chính Sách</span>
              </span>
              <span className="badge bg-light text-dark border">Bắt buộc</span>
            </div>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label htmlFor="modal-policy-title" className="modal-field-label">
                  <span>Tên chính sách</span>
                  <span className="req" aria-hidden="true">*</span>
                </label>
                <span className="policy-char-counter small">{title.length}/200</span>
              </div>
              <input
                ref={titleInputRef}
                id="modal-policy-title"
                type="text"
                className="form-control"
                maxLength={200}
                placeholder="Ví dụ: Chính Sách Thuê Trang Phục VESTORA..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError) setValidationError('');
                }}
                required
              />
            </div>

            <div>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label htmlFor="modal-policy-summary" className="modal-field-label d-flex align-items-center gap-1">
                  <Sparkles size={13} className="text-gold" aria-hidden="true" />
                  <span>Tóm tắt nổi bật (Tùy chọn)</span>
                </label>
                <span className="policy-char-counter small">{summary.length}/500</span>
              </div>
              <textarea
                id="modal-policy-summary"
                rows={2}
                maxLength={500}
                className="form-control"
                placeholder="Tóm tắt ngắn gọn 1-2 câu điểm cốt lõi của chính sách này để hiển thị trên khung tóm lược..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Nội dung điều khoản chi tiết */}
          <div className="modal-section-card mb-3">
            <div className="modal-section-header">
              <span className="modal-section-title">
                <Sparkles size={14} className="text-gold" aria-hidden="true" />
                <span>2. Nội Dung Điều Khoản Chi Tiết</span>
              </span>
              <span className="badge bg-light text-dark border">Văn bản</span>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-1">
              <label htmlFor="modal-policy-content" className="modal-field-label">
                <span>Nội dung chi tiết</span>
              </label>
              <span className="text-muted small" style={{ fontSize: '11.5px' }}>
                Hỗ trợ đánh số (1., 2.) & gạch đầu dòng (-)
              </span>
            </div>
            <textarea
              id="modal-policy-content"
              rows={6}
              className="form-control"
              placeholder="1. Điều Kiện Áp Dụng&#10;- Điều khoản 1&#10;- Điều khoản 2&#10;&#10;2. Quyền Lợi & Trách Nhiệm&#10;- Nội dung chi tiết..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Section 3: Trạng thái hiển thị */}
          <div className="modal-section-card mb-0">
            <div className="modal-section-header">
              <span className="modal-section-title">
                <CheckCircle2 size={14} className="text-emerald" aria-hidden="true" />
                <span>3. Trạng Thái Hiển Thị</span>
              </span>
              <span className={`badge ${isActive ? 'bg-success-subtle text-success border-success-subtle' : 'bg-light text-secondary border'}`}>
                {isActive ? 'Đang Kích Hoạt' : 'Tạm Ẩn'}
              </span>
            </div>

            <div className="d-flex align-items-center justify-content-between p-2">
              <div>
                <span className="fw-semibold d-block text-dark small">Hiển thị cho khách hàng</span>
                <small className="text-muted">
                  Bật để khách hàng có thể đọc chính sách này trên Cổng Khách Hàng (/policy).
                </small>
              </div>
              <Form.Check
                type="switch"
                id="modal-policy-isactive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="m-0 fs-5"
                aria-label="Kích hoạt chính sách"
              />
            </div>
          </div>
        </div>

        {/* 3. Modal Footer Luxury Chuẩn Hệ Thống */}
        <div className="vestora-modal-footer">
          <button
            type="button"
            className="btn-modal-secondary"
            onClick={onHide}
            disabled={isCreating}
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            className="btn-modal-primary"
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Spinner size="sm" animation="border" />
                <span>Đang tạo...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Tạo Chính Sách</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default memo(CreatePolicyModal);
