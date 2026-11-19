import React, { useCallback, useEffect, useState } from 'react';
import { Button, ProgressBar } from 'react-bootstrap';
import inventoryInsightService from '../../../services/warehouse/inventoryInsightService';
import { STORAGE_TYPE_LABELS, labelOf } from '../../../constants/warehouseLabels';

const number = (value) => Number(value || 0).toLocaleString('vi-VN');
/** Màu theo ngưỡng do server tính: < 80% bình thường, 80–95% vàng, > 95% đỏ. */
const TONE_VARIANT = { normal: 'success', warning: 'warning', danger: 'danger' };

function UsageBar({ used, maxCapacity, percent, tone }) {
  if (maxCapacity == null) return <span className="wm-capacity-text">Đang chứa {number(used)} · chưa đặt sức chứa tối đa</span>;
  return (
    <div className="wm-capacity-usage">
      <ProgressBar now={Math.min(100, percent || 0)} variant={TONE_VARIANT[tone] || 'success'} />
      <span className={`wm-capacity-text wm-capacity-${tone}`}>
        {number(used)} / {number(maxCapacity)} ({percent ?? 0}%)
      </span>
    </div>
  );
}

function CapacityNode({ node, depth }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  return (
    <li className="wm-capacity-node">
      <div className="wm-capacity-row">
        {hasChildren ? (
          <button type="button" className="wm-text-button" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? '▾' : '▸'}
          </button>
        ) : <span className="wm-capacity-leaf" />}
        <span className="wm-capacity-name">
          <strong>{node.code}</strong> {labelOf(STORAGE_TYPE_LABELS, node.type, '')}
          {node.status !== 'active' && <small> (ngừng dùng)</small>}
        </span>
        <UsageBar {...node} />
      </div>
      {hasChildren && open && (
        <ul className="wm-capacity-tree">
          {node.children.map((child) => <CapacityNode key={child._id} node={child} depth={depth + 1} />)}
        </ul>
      )}
    </li>
  );
}

/**
 * Sức chứa kho tổng: thẻ tổng "Đang chứa / Sức chứa tối đa" và cây Khu → Dãy → Kệ.
 * Số "đang chứa" là tổng tồn trên kệ (không tính hàng đang cho thuê / đang vận chuyển), cùng cách
 * hệ thống kiểm sức chứa khi nhập hàng.
 */
export default function CentralCapacityPanel() {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    setState((old) => ({ ...old, loading: true, error: '' }));
    inventoryInsightService.getCapacity()
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({ loading: false, error: error.message, data: null }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = state.data?.summary;
  return (
    <section className="wm-panel wm-capacity-panel">
      <header className="wm-capacity-header">
        <div>
          <strong>Sức chứa kho tổng</strong>
          {summary && <small> · {summary.code} {summary.name}</small>}
        </div>
        <Button size="sm" variant="outline-secondary" onClick={() => setExpanded(!expanded)} disabled={!state.data}>
          {expanded ? 'Ẩn theo vị trí' : 'Xem theo Khu → Dãy → Kệ'}
        </Button>
      </header>
      {state.error && <div className="wm-error">{state.error}</div>}
      {state.loading && !state.data && <div className="wm-tree-empty">Đang tải sức chứa...</div>}
      {summary && <UsageBar {...summary} />}
      {summary?.committed > 0 && (
        <small className="wm-stock-subline">
          Phiếu nhập / hàng trả đang về đã đặt trước {number(summary.committed)} chỗ (chưa tính vào đang chứa).
        </small>
      )}
      {expanded && state.data && (
        <ul className="wm-capacity-tree">
          {state.data.tree.map((node) => <CapacityNode key={node._id} node={node} depth={0} />)}
          {!state.data.tree.length && <li className="wm-tree-empty">Kho tổng chưa có vị trí lưu trữ.</li>}
        </ul>
      )}
    </section>
  );
}
