import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { itemCodeOf } from './itemSelectionRules';

/**
 * Một nhóm món hiển thị gọn "Kệ A-01-03: 4 món"; bấm để mở / đóng danh sách mã hàng.
 * @param {object} props
 * @param {string} [props.label] tên nhóm (vd "Kệ A-01-03"); bỏ trống thì chỉ hiện số món
 * @param {Array<object|string>} props.items món (object có itemCode, hoặc id)
 * @param {(item: object|string) => string} [props.codeOf] lấy mã hiển thị (mặc định itemCode)
 */
export function ItemCodeGroup({ label, items = [], codeOf = itemCodeOf }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;
  const title = label ? `${label}: ${items.length} món` : `${items.length} món`;
  if (!items.length) return <small className="wm-stock-subline">{title}</small>;
  return <div>
    <button type="button" className="wm-text-button p-0" onClick={() => setOpen(!open)} aria-expanded={open}>
      <Icon size={14} /> {title}
    </button>
    {open && <small className="wm-stock-subline mt-1">{items.map(codeOf).join(', ')}</small>}
  </div>;
}

/**
 * Danh sách món đã chọn, nhóm theo kệ.
 * @param {{ groups: { key: string, label: string, items: object[] }[], codeOf?: Function, emptyText?: string }} props
 */
export default function ItemCodeGroups({ groups = [], codeOf, emptyText = 'Chưa có món nào.' }) {
  if (!groups.length) return <small className="wm-stock-subline">{emptyText}</small>;
  return <div className="d-grid gap-1">
    {groups.map((group) => <ItemCodeGroup key={group.key} label={group.label} items={group.items} codeOf={codeOf} />)}
  </div>;
}
