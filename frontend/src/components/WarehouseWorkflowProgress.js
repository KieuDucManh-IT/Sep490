import React from 'react';
import { Check } from 'lucide-react';

const flows = {
  inbound: { labels: ['Tạo phiếu', 'Tiếp nhận', 'Duyệt', 'Xếp kệ'], states: ['created', 'awaiting_receiving', 'received', 'approved'] },
  transfer: { labels: ['Yêu cầu', 'Duyệt', 'Soạn hàng', 'Điều chuyển', 'Nhận hàng'], states: ['requested', 'approved', 'preparing', 'shipped', 'received'] },
  branchReturn: { labels: ['Yêu cầu', 'Duyệt & khóa hàng', 'Gửi hàng', 'Kiểm nhận', 'Xếp kệ', 'Hoàn tất'], states: ['requested', 'approved', 'shipped', 'receipt_submitted', 'receipt_approved', 'completed'] },
  stocktake: { labels: ['Tạo phiếu', 'Kiểm đếm', 'Duyệt', 'Điều chỉnh tồn'], states: ['draft', 'in_progress', 'counted', 'approved'] },
  adjustment: { labels: ['Chờ duyệt', 'Đã duyệt', 'Cập nhật tồn'], states: ['requested', 'approved', 'applied'] },
};

export default function WarehouseWorkflowProgress({ flow, status }) {
  const definition = flows[flow];
  if (!definition) return null;
  const terminal = ['rejected', 'cancelled'].includes(status);
  let current = definition.states.indexOf(status);
  if (flow === 'transfer' && status === 'partially_received') current = definition.states.indexOf('received');
  if (['completed', 'received', 'applied'].includes(status)) current = definition.states.length;
  if (terminal) current = -1;
  return <nav className={`wm-workflow ${terminal ? 'is-terminal' : ''}`} aria-label="Tiến độ phiếu">
    {definition.labels.map((label, index) => <div key={label} className={`wm-workflow-step ${index < current ? 'is-done' : ''} ${index === current ? 'is-current' : ''}`} aria-current={index === current ? 'step' : undefined}>
      <span className="wm-workflow-marker">{index < current ? <Check size={13} /> : index + 1}</span><span>{label}</span>
    </div>)}
    {terminal && <strong className="wm-workflow-terminal">{status === 'rejected' ? 'Phiếu bị từ chối' : 'Phiếu đã hủy'}</strong>}
  </nav>;
}
