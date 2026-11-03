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
  activeKey,
  policyData,
  onChangeField,
  onDeletePolicy,
  isDeleting = false,
}) {
  const [contentViewMode, setContentViewMode] = useState('edit'); // 'edit' | 'preview'

  const title = policyData?.title ?? '';
  const displayHeading = title || activeKey;
  const summary = policyData?.summary ?? '';
  const content = policyData?.content ?? '';
  const isActive = policyData?.isActive !== false;

  const summaryCountClass =
    summary.length >= 500
      ? 'policy-char-counter danger'
      : summary.length >= 450
      ? 'policy-char-counter warning'
      : 'policy-char-counter';

  const titleCountClass =
    title.length >= 200
      ? 'policy-char-counter danger'
      : title.length >= 180
      ? 'policy-char-counter warning'
      : 'policy-char-counter';

  const handleDelete = () => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa chính sách "${displayHeading}" không? Thao tác này sẽ gỡ bỏ chính sách khỏi hệ thống chuỗi.`)) {
      onDeletePolicy(activeKey);
    }
  };

  return (
    <section
      className="policy-editor-card"
      role="tabpanel"
      id={`policy-tabpanel-${activeKey}`}
      aria-labelledby={`policy-tab-${activeKey}`}
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
              id={`toggle-${activeKey}`}
              checked={isActive}
              onChange={(e) => onChangeField(activeKey, 'isActive', e.target.checked)}
              className="m-0"
              aria-label={`Trạng thái kích hoạt của ${displayHeading}`}
            />
            <label
              htmlFor={`toggle-${activeKey}`}
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
            <label htmlFor={`policy-input-title-${activeKey}`} className="policy-editor-label">
              Tiêu đề chính sách hiển thị trên Cổng Khách Hàng <span className="text-danger">*</span>
            </label>
            <span className={titleCountClass}>
              {title.length}/200
            </span>
          </div>

          <input
            id={`policy-input-title-${activeKey}`}
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => onChangeField(activeKey, 'title', e.target.value)}
            placeholder="Ví dụ: Chính Sách Thuê Trang Phục VESTORA"
            className="policy-editor-input"
            aria-required="true"
          />
        </div>

        {/* 2. Tóm tắt nổi bật (Summary Highlight) */}
        <div className="policy-editor-field">
          <div className="policy-editor-label-row">
            <label htmlFor={`policy-textarea-summary-${activeKey}`} className="policy-editor-label">
              <Sparkles size={16} color="var(--vp-gold)" aria-hidden="true" />
              <span>Tóm tắt nổi bật (Khung thông tin tóm lược)</span>
            </label>
            <span className={summaryCountClass}>
              {summary.length}/500
            </span>
          </div>

          <textarea
            id={`policy-textarea-summary-${activeKey}`}
            rows={3}
            maxLength={500}
            value={summary}
            onChange={(e) => onChangeField(activeKey, 'summary', e.target.value)}
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
            <label htmlFor={`policy-textarea-content-${activeKey}`} className="policy-editor-label">
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
                id={`policy-textarea-content-${activeKey}`}
                rows={12}
                value={content}
                onChange={(e) => onChangeField(activeKey, 'content', e.target.value)}
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
