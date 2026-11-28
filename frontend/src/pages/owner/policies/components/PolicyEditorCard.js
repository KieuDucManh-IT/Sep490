import React, { memo, useState } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import { Sparkles, Eye, Info, Edit3, Trash2, FileText } from 'lucide-react';

function renderFormattedPreview(text) {
  if (!text) {
    return <p className="text-muted fst-italic">Chưa có nội dung điều khoản chi tiết.</p>;
  }

  const lines = text.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`}>
          {currentList.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (/^\d+\./.test(trimmed)) {
      flushList();
      elements.push(<h3 key={`h3-${idx}`}>{trimmed}</h3>);
    } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      currentList.push(trimmed.substring(1).trim());
    } else {
      flushList();
      elements.push(<p key={`p-${idx}`}>{trimmed}</p>);
    }
  });

  flushList();
  return elements;
}

/**
 * PolicyEditorCard - Thẻ biên tập chi tiết từng phân đoạn chính sách
 * Hỗ trợ WAI-ARIA tabpanel, Form Labels, Character Counters, Live Preview & Xóa chính sách
 */
function PolicyEditorCard({
  activeId,
  policyData,
  policies = [],
  onChangeField,
  onDeletePolicy,
  isDeleting = false,
}) {
  const [contentViewMode, setContentViewMode] = useState('edit'); // 'edit' | 'preview'

  const itemId = policyData?._id || activeId;
  const title = policyData?.title ?? '';
  const displayHeading = title || 'Chính sách';
  const summary = policyData?.summary ?? '';
  const content = policyData?.content ?? '';
  const isActive = policyData?.isActive !== false;

  const summaryCountClass =
    summary.length >= 500
      ? 'policy-char-counter danger'
      : summary.length >= 450
      ? 'policy-char-counter warning'
      : 'policy-char-counter';

  const isTitleEmpty = !title.trim();
  const isDuplicate = Boolean(
    title.trim() &&
    policies.some(
      (p) =>
        (p._id || p.id) !== itemId &&
        (p.title || '').trim().toLowerCase() === title.trim().toLowerCase()
    )
  );

  const titleCountClass =
    title.length >= 200
      ? 'policy-char-counter danger'
      : title.length >= 180
      ? 'policy-char-counter warning'
      : 'policy-char-counter';

  const handleDelete = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa chính sách "${displayHeading}" không? Thao tác này sẽ gỡ bỏ chính sách khỏi hệ thống chuỗi.`)) {
      onDeletePolicy(itemId);
    }
  };

  return (
    <section
      className="policy-editor-card"
      role="tabpanel"
      id={`policy-tabpanel-${itemId}`}
      aria-labelledby={`policy-tab-${itemId}`}
    >
      {/* Header của thẻ biên tập */}
      <div className="policy-editor-header">
        <div className="policy-editor-title-group">
          <div className="policy-editor-icon-box" aria-hidden="true">
            <FileText size={22} />
          </div>

          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="policy-editor-kicker">
                CHÍNH SÁCH VẬN HÀNH CHUỖI
              </span>
            </div>
            <h2 className="policy-editor-heading">
              {displayHeading}
            </h2>
          </div>
        </div>

        {/* Nút hành động: Trạng thái hiển thị + Nút Xóa chính sách */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className={`policy-editor-status-toggle ${isActive ? 'active' : ''}`}>
            <Form.Check
              type="switch"
              id={`toggle-${itemId}`}
              checked={isActive}
              onChange={(e) => onChangeField(itemId, 'isActive', e.target.checked)}
              className="m-0"
              aria-label={`Trạng thái kích hoạt của ${displayHeading}`}
            />
            <label
              htmlFor={`toggle-${itemId}`}
              className="policy-editor-status-label"
            >
              {isActive ? 'Đang áp dụng (BẬT)' : 'Tạm ẩn'}
            </label>
          </div>

          {onDeletePolicy ? (
            <button
              type="button"
              className="policy-btn-delete"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Xóa chính sách này khỏi hệ thống chuỗi"
            >
              {isDeleting ? (
                <Spinner size="sm" animation="border" />
              ) : (
                <Trash2 size={15} />
              )}
              <span>Xóa</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Form chỉnh sửa nội dung */}
      <div className="policy-editor-form">
        {/* 1. Tiêu đề hiển thị */}
        <div className="policy-editor-field">
          <div className="policy-editor-label-row">
            <label htmlFor={`policy-input-title-${itemId}`} className="policy-editor-label">
              Tiêu đề chính sách hiển thị trên Cổng Khách Hàng <span className="text-danger">*</span>
            </label>
            <span className={titleCountClass}>
              {title.length}/200
            </span>
          </div>

          <input
            id={`policy-input-title-${itemId}`}
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => onChangeField(itemId, 'title', e.target.value)}
            placeholder="Ví dụ: Chính Sách Thuê Trang Phục VESTORA"
            className={`policy-editor-input ${isTitleEmpty || isDuplicate ? 'border-danger' : ''}`}
            aria-required="true"
          />
          {isTitleEmpty ? (
            <span className="text-danger small mt-1 d-block" style={{ fontSize: '12px' }}>
              ⚠️ Tên chính sách là bắt buộc, không được để trống.
            </span>
          ) : isDuplicate ? (
            <span className="text-danger small mt-1 d-block" style={{ fontSize: '12px' }}>
              ⚠️ Tên chính sách đã bị trùng lặp với một chính sách khác trong danh mục.
            </span>
          ) : null}
        </div>

        {/* 2. Tóm tắt nổi bật (Summary Highlight) */}
        <div className="policy-editor-field">
          <div className="policy-editor-label-row">
            <label htmlFor={`policy-textarea-summary-${itemId}`} className="policy-editor-label">
              <Sparkles size={16} color="var(--vp-gold)" aria-hidden="true" />
              <span>Tóm tắt nổi bật (Khung thông tin tóm lược)</span>
            </label>
            <span className={summaryCountClass}>
              {summary.length}/500
            </span>
          </div>

          <textarea
            id={`policy-textarea-summary-${itemId}`}
            rows={3}
            maxLength={500}
            value={summary}
            onChange={(e) => onChangeField(itemId, 'summary', e.target.value)}
            placeholder="Tóm tắt ngắn gọn các điều khoản cốt lõi của chính sách này để hiển thị trên thẻ nổi bật..."
            className="policy-editor-textarea"
          />

          {/* Hộp xem trước tóm tắt nổi bật */}
          {summary ? (
            <div className="policy-editor-callout-preview" aria-live="polite">
              <Eye size={16} className="policy-editor-callout-icon" aria-hidden="true" />
              <div>
                <strong>Xem trước hiển thị:</strong> {summary}
              </div>
            </div>
          ) : null}
        </div>

        {/* 3. Nội dung điều khoản chi tiết */}
        <div className="policy-editor-field">
          <div className="policy-editor-label-row">
            <label htmlFor={`policy-textarea-content-${itemId}`} className="policy-editor-label">
              Nội dung các điều khoản chi tiết <span className="text-danger">*</span>
            </label>

            {/* Chuyển đổi giữa chế độ Biên tập và Xem trước định dạng */}
            <div className="policy-view-mode-tabs" role="group" aria-label="Chế độ xem nội dung">
              <button
                type="button"
                className={`policy-view-mode-btn ${contentViewMode === 'edit' ? 'active' : ''}`}
                onClick={() => setContentViewMode('edit')}
              >
                <Edit3 size={13} aria-hidden="true" />
                <span>Soạn thảo</span>
              </button>
              <button
                type="button"
                className={`policy-view-mode-btn ${contentViewMode === 'preview' ? 'active' : ''}`}
                onClick={() => setContentViewMode('preview')}
              >
                <Eye size={13} aria-hidden="true" />
                <span>Xem trước</span>
              </button>
            </div>
          </div>

          {contentViewMode === 'edit' ? (
            <>
              <textarea
                id={`policy-textarea-content-${itemId}`}
                rows={12}
                value={content}
                onChange={(e) => onChangeField(itemId, 'content', e.target.value)}
                placeholder="Nhập chi tiết các điều khoản chính sách (hỗ trợ đánh số 1., 2. để tạo tiêu đề con và gạch đầu dòng - để tạo danh sách)..."
                className="policy-editor-textarea content-area"
                aria-required="true"
              />
              <span className="policy-editor-tip mt-2">
                <Info size={14} aria-hidden="true" />
                <span>Mẹo định dạng: Đánh số mục (1., 2.) để tạo tiêu đề con; dùng gạch đầu dòng (-) để tạo danh sách tự động.</span>
              </span>
            </>
          ) : (
            <div className="policy-preview-formatted-card">
              {renderFormattedPreview(content)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default memo(PolicyEditorCard);
