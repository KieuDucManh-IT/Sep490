import React from 'react';
import { ChevronDown, ChevronRight, Eye, Pencil, Plus, Trash2, Warehouse } from 'lucide-react';
import { STORAGE_TYPE_LABELS, labelOf } from '../../../constants/warehouseLabels';
import { childCapacity } from './storageHelpers';

const CHILD_TYPE = { zone: 'row', row: 'shelf' };

function NodeActions({ node, onCreateChild, onView, onEdit, onRemove }) {
  const childType = CHILD_TYPE[node.type];
  return (
    <div className="wm-tree-actions">
      {childType && (
        <button type="button" onClick={() => onCreateChild(node)}>
          <Plus size={14} />Thêm {labelOf(STORAGE_TYPE_LABELS, childType).toLowerCase()}
        </button>
      )}
      <button type="button" onClick={() => onView(node)} aria-label={`Xem ${node.code}`}><Eye size={14} />Xem</button>
      <button type="button" onClick={() => onEdit(node)} aria-label={`Sửa ${node.code}`}><Pencil size={14} />Sửa</button>
      <button type="button" className="danger" onClick={() => onRemove(node)} aria-label={`Xóa ${node.code}`}>
        <Trash2 size={14} />Xóa
      </button>
    </div>
  );
}

function NodeTitle({ node, children }) {
  return (
    <span className="wm-tree-title">
      <span className="wm-node-type">{labelOf(STORAGE_TYPE_LABELS, node.type, node.type)}</span>
      <strong>{node.code}</strong>
      <span>{node.name}</span>
      {children}
    </span>
  );
}

function Toggle({ isOpen, size, onClick }) {
  return (
    <button className="wm-tree-toggle" type="button" onClick={onClick} aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}>
      {isOpen ? <ChevronDown size={size} /> : <ChevronRight size={size} />}
    </button>
  );
}

/**
 * Cây vị trí lưu trữ của một khu (hoặc một khu tạm): Khu → Dãy → Kệ, có nút thêm cấp con / xem / sửa / xóa.
 * `tree` cung cấp dữ liệu và trạng thái mở rộng; `actions` là các hàm mở modal / xóa.
 */
export default function StorageTree({ root, tree, actions }) {
  const { rows, expanded, toggle, childrenOf, visibleRowsForZone, matches, locationName } = tree;

  if (root.type === 'temporary_area') {
    return (
      <section className="wm-zone-card">
        <div className="wm-tree-node wm-zone-node">
          <Warehouse size={19} className="wm-zone-icon" />
          <NodeTitle node={root}><small>{root.maxCapacity ?? '—'} cái</small></NodeTitle>
          <NodeActions node={root} {...actions} />
        </div>
      </section>
    );
  }

  const renderShelf = (shelf) => (
    <div className="wm-tree-node wm-shelf-node" key={shelf._id}>
      <NodeTitle node={shelf}><small>Sức chứa: {shelf.maxCapacity ?? '—'} cái</small></NodeTitle>
      <NodeActions node={shelf} {...actions} />
    </div>
  );

  const renderRow = (row) => {
    const shelves = childrenOf(row._id, 'shelf').filter(matches);
    const isOpen = expanded[row._id] ?? true;
    return (
      <div className="wm-tree-group wm-row-group" key={row._id}>
        <div className="wm-tree-node">
          <Toggle isOpen={isOpen} size={17} onClick={() => toggle(row._id)} />
          <NodeTitle node={row}>
            <small>{shelves.length} kệ · {childCapacity(rows, row._id)} / {row.maxCapacity ?? '∞'} cái</small>
          </NodeTitle>
          <NodeActions node={row} {...actions} />
        </div>
        {isOpen && (
          <div className="wm-tree-children">
            {shelves.length ? shelves.map(renderShelf) : <div className="wm-tree-empty">Không có kệ phù hợp.</div>}
          </div>
        )}
      </div>
    );
  };

  const treeRows = visibleRowsForZone(root);
  const isOpen = expanded[root._id] ?? true;
  return (
    <section className="wm-zone-card">
      <div className="wm-tree-node wm-zone-node">
        <Toggle isOpen={isOpen} size={18} onClick={() => toggle(root._id)} />
        <Warehouse size={19} className="wm-zone-icon" />
        <NodeTitle node={root}>
          <small className="wm-tree-location">{locationName(root)}</small>
          <small>{childrenOf(root._id, 'row').length} dãy · {childCapacity(rows, root._id)} / {root.maxCapacity ?? '∞'} cái</small>
        </NodeTitle>
        <NodeActions node={root} {...actions} />
      </div>
      {isOpen && (
        <div className="wm-tree-children">
          {treeRows.length ? treeRows.map(({ row }) => renderRow(row)) : <div className="wm-tree-empty">Không có dãy phù hợp.</div>}
        </div>
      )}
    </section>
  );
}
