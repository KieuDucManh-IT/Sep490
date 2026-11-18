import React from 'react';
import { labelOf } from '../../constants/warehouseLabels';
import '../../styles/WarehouseManager.css';

/**
 * Badge trạng thái phiếu / món hàng. Dùng class `wm-status-badge status-<status>` có sẵn.
 * @param {object} props
 * @param {string} props.status mã trạng thái (ví dụ 'approved')
 * @param {Record<string, string>} props.labels bảng nhãn trong constants/warehouseLabels.js
 * @param {Record<string, string>} [props.classMap] đổi màu: ánh xạ status → class `status-*` khác
 *   (ví dụ DISCREPANCY_STATUS_CLASS)
 * @param {string} [props.fallback] chữ hiển thị khi status không có trong bảng nhãn
 */
export default function StatusBadge({ status, labels, classMap, fallback }) {
  const toneClass = classMap?.[status] || `status-${status}`;
  return <span className={`wm-status-badge ${toneClass}`}>{labelOf(labels, status, fallback)}</span>;
}
