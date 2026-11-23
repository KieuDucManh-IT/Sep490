import React from 'react';
import { Check } from 'lucide-react';

const flows = {
  inbound: { labels: ['Tạo phiếu', 'Tiếp nhận', 'Duyệt', 'Xếp kệ'], states: ['created', 'awaiting_receiving', 'received', 'approved'] },
  transfer: { labels: ['Yêu cầu', 'Duyệt', 'Soạn hàng', 'Điều chuyển', 'Nhận hàng'], states: ['requested', 'approved', 'preparing', 'shipped', 'completed'] },
  branchReturn: { labels: ['Yêu cầu', 'Duyệt & khóa hàng', 'Gửi hàng', 'Kiểm nhận', 'Xếp kệ', 'Hoàn tất'], states: ['requested', 'approved', 'shipped', 'receipt_submitted', 'receipt_approved', 'completed'] },
  // TASK-016 B: duyệt = áp dụng ngay, không còn bước điều chỉnh tồn riêng.
  stocktake: { labels: ['Tạo phiếu', 'Kiểm đếm', 'Chờ duyệt', 'Đã duyệt & áp dụng'], states: ['draft', 'in_progress', 'counted', 'approved'] },
  adjustment: { labels: ['Chờ duyệt', 'Đã duyệt', 'Cập nhật tồn'], states: ['requested', 'approved', 'applied'] },
};

export default function WarehouseWorkflowProgress({ flow, status }) {
  const definition = flows[flow];
  if (!definition) return null;
  const terminal = ['rejected', 'cancelled'].includes(status);
  let current = definition.states.indexOf(status);
  // TASK-016 D: điều chuyển hai chiều cùng kết thúc ở `completed`.
  if (['completed', 'applied'].includes(status) || (flow === 'stocktake' && status === 'approved')) current = definition.states.length;
  if (terminal) current = -1;
  return <nav className={`wm-workflow ${terminal ? 'is-terminal' : ''}`} aria-label="Tiến độ phiếu">
    {definition.labels.map((label, index) => <div key={label} className={`wm-workflow-step ${index < current ? 'is-done' : ''} ${index === current ? 'is-current' : ''}`} aria-current={index === current ? 'step' : undefined}>
      <span className="wm-workflow-marker">{index < current ? <Check size={13} /> : index + 1}</span><span>{label}</span>
    </div>)}
    {terminal && <strong className="wm-workflow-terminal">{status === 'rejected' ? 'Phiếu bị từ chối' : 'Phiếu đã hủy'}</strong>}
  </nav>;
}
