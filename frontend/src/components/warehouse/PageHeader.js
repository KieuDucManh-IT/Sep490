import React from 'react';
import '../../styles/WarehouseShared.css';

/**
 * Header đầu trang kho: nhãn nhỏ, tiêu đề, mô tả và các nút hành động bên phải.
 * @param {object} props
 * @param {string} [props.eyebrow] nhãn nhỏ phía trên tiêu đề (ví dụ "QUẢN LÝ KHO")
 * @param {React.ReactNode} props.title tiêu đề trang
 * @param {React.ReactNode} [props.description] một dòng mô tả dưới tiêu đề
 * @param {React.ReactNode} [props.actions] các nút hành động (Làm mới, Tạo phiếu...)
 */
export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="wh-page-header">
      <div className="wh-page-heading">
        {eyebrow && <span className="wh-page-eyebrow">{eyebrow}</span>}
        <h1 className="wh-page-title">{title}</h1>
        {description && <p className="wh-page-desc">{description}</p>}
      </div>
      {actions && <div className="wh-page-actions">{actions}</div>}
    </header>
  );
}
