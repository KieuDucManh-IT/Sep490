import React from 'react';
import '../../styles/WarehouseShared.css';

const DEFAULT_LIMIT_OPTIONS = [10, 20, 50, 100];

/**
 * Thanh phân trang cho danh sách phân trang phía server (`{ items, total, page, limit }`).
 * @param {object} props
 * @param {number} props.page trang hiện tại, bắt đầu từ 1
 * @param {number} props.limit số dòng mỗi trang
 * @param {number} props.total tổng số bản ghi khớp bộ lọc
 * @param {(page: number) => void} props.onChange gọi khi đổi trang (trang tự gọi lại API)
 * @param {(limit: number) => void} [props.onLimitChange] có thì hiện ô chọn số dòng
 * @param {number[]} [props.limitOptions] các lựa chọn số dòng
 * @param {boolean} [props.disabled] khóa nút khi đang tải
 */
export default function Pagination({
  page = 1,
  limit = 20,
  total = 0,
  onChange,
  onLimitChange,
  limitOptions = DEFAULT_LIMIT_OPTIONS,
  disabled = false,
}) {
  const safeLimit = Math.max(1, Number(limit) || 1);
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const firstRow = (currentPage - 1) * safeLimit + 1;
  const lastRow = Math.min(currentPage * safeLimit, safeTotal);

  let summary = '0 kết quả';
  if (safeTotal > 0) summary = `${firstRow}–${lastRow} / ${safeTotal}`;

  return (
    <div className="wh-pagination">
      <span>{summary}</span>
      <div className="wh-pagination-controls">
        {onLimitChange && (
          <label className="wh-pagination-limit">
            Số dòng
            <select value={safeLimit} disabled={disabled} onChange={(event) => onLimitChange(Number(event.target.value))}>
              {limitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
        <button type="button" disabled={disabled || currentPage <= 1} onClick={() => onChange(currentPage - 1)}>
          Trước
        </button>
        <span>Trang {currentPage} / {totalPages}</span>
        <button type="button" disabled={disabled || currentPage >= totalPages} onClick={() => onChange(currentPage + 1)}>
          Sau
        </button>
      </div>
    </div>
  );
}
