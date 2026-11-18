import React from 'react';

/**
 * Thanh tìm kiếm + lọc trạng thái phía trên danh sách phiếu.
 * @param {object} props
 * @param {string} props.searchLabel nhãn ô tìm (nói rõ tìm được theo gì)
 * @param {string} props.searchValue chữ đang gõ
 * @param {(value: string) => void} props.onSearchChange
 * @param {string} props.status trạng thái đang lọc ('' = tất cả)
 * @param {(value: string) => void} props.onStatusChange
 * @param {Array<[string, string]>} props.statusOptions danh sách [giá trị, nhãn]; nên có ['', 'Tất cả']
 * @param {React.ReactNode} [props.children] bộ lọc thêm (nếu có)
 */
export default function SlipListToolbar({
  searchLabel,
  searchValue,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  children,
}) {
  return (
    <div className="wm-list-toolbar">
      <label className="wm-search-field">
        {searchLabel}
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Nhập từ khóa..."
        />
      </label>
      <label>
        Trạng thái
        <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
          {statusOptions.map(([value, text]) => (
            <option key={value || 'all'} value={value}>{text}</option>
          ))}
        </select>
      </label>
      {children}
    </div>
  );
}

/** Tạo danh sách lựa chọn trạng thái từ bảng nhãn, có "Tất cả" ở đầu. */
export function statusOptionsFrom(labels) {
  return [['', 'Tất cả'], ...Object.entries(labels)];
}
