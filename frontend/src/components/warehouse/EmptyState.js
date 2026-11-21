import React from 'react';
import { Inbox } from 'lucide-react';
import '../../styles/WarehouseShared.css';

/**
 * Ô trống viền nét đứt khi danh sách không có dữ liệu.
 * @param {object} props
 * @param {React.ComponentType} [props.icon] icon lucide (mặc định Inbox)
 * @param {React.ReactNode} [props.title] dòng chữ đậm
 * @param {React.ReactNode} [props.description] giải thích thêm / gợi ý bước tiếp theo
 * @param {React.ReactNode} [props.action] nút hành động (ví dụ "Tạo phiếu")
 */
export default function EmptyState({ icon: Icon = Inbox, title = 'Chưa có dữ liệu', description, action }) {
  return (
    <div className="wh-empty-panel">
      <Icon size={26} strokeWidth={1.6} className="wh-empty-icon" />
      {title && <strong className="wh-empty-title">{title}</strong>}
      {description && <p className="wh-empty-desc">{description}</p>}
      {action && <div className="wh-empty-action">{action}</div>}
    </div>
  );
}
