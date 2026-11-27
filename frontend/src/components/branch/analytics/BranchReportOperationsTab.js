import React from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  ShieldAlert,
  ArrowRight,
  Phone,
  CheckCircle2,
} from 'lucide-react';

const ISSUE_TYPE_LABELS = {
  OVERDUE: 'Trễ hạn trả đồ',
  DAMAGE_DISPUTE: 'Khiếu nại / Hư hỏng',
  FAILED_SHIPMENT: 'Giao vận thất bại',
};

function formatVnd(amount) {
  const num = Number(amount || 0);
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} ₫`;
}

function formatTimeOnly(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDateShortVi(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo}`;
}

export default function BranchReportOperationsTab({
  operations = {},
  upcomingReturns = [],
  operationalIssues = [],
}) {
  return (
    <div className="ba-tab-content">
      {/* 4 Thẻ tác vụ nhanh */}
      <section className="ba-ops-counters" aria-label="Tác vụ kho và đơn hàng cần xử lý">
        <div className="ba-ops-counter">
          <span className="ba-ops-counter__val">{operations.pendingHandoverCount || 0}</span>
          <span className="ba-ops-counter__lbl">Chờ bàn giao</span>
        </div>
        <div className="ba-ops-counter">
          <span className="ba-ops-counter__val">{operations.openDisputesCount || 0}</span>
          <span className="ba-ops-counter__lbl">Khiếu nại mở</span>
        </div>
        <div className="ba-ops-counter">
          <span className="ba-ops-counter__val">
            {operations.incomingTransfersToReceiveCount || 0}
          </span>
          <span className="ba-ops-counter__lbl">Phiếu kho đến</span>
        </div>
        <div className="ba-ops-counter">
          <span className="ba-ops-counter__val">{operations.failedShipmentsCount || 0}</span>
          <span className="ba-ops-counter__lbl">Giao vận lỗi</span>
        </div>
      </section>

      <div className="ba-grid-operations">
        {/* Lịch đồ sắp hoàn trả (48h) */}
        <article className="ba-card" aria-label="Lịch đồ sắp hoàn trả trong 48 giờ tới">
          <div className="ba-card__header">
            <div>
              <h2 className="ba-card__title">
                <Clock size={18} aria-hidden="true" />
                <span>Lịch Đồ Sắp Hoàn Trả Trong 48 Giờ Tới</span>
              </h2>
              <p className="ba-card__subtitle">
                Danh sách đơn thuê sắp đến hạn trả để chuẩn bị tiếp nhận và kiểm định hoàn cọc
              </p>
            </div>
            <Link to="/branch/returns" className="ba-link-action">
              <span>Mở màn hình Kiểm Định Nhận Trả</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {upcomingReturns.length === 0 ? (
            <div className="ba-section-empty">
              <Clock size={20} aria-hidden="true" />
              <span>Không có đơn thuê nào đến hạn hoàn trả trong 48 giờ tới.</span>
            </div>
          ) : (
            <div className="ba-table-wrap">
              <table className="ba-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Trang phục chính</th>
                    <th>Hạn trả</th>
                    <th>Tiền cọc giữ</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingReturns.map((item) => (
                    <tr key={item._id}>
                      <td className="ba-order-code-cell">
                        <strong>{item.orderCode}</strong>
                      </td>
                      <td className="ba-customer-cell">
                        <div className="ba-customer-name">{item.customerName}</div>
                        {item.customerPhone && (
                          <div className="ba-product-row__meta">
                            <Phone size={11} aria-hidden="true" />
                            <span>{item.customerPhone}</span>
                          </div>
                        )}
                      </td>
                      <td className="ba-product-cell" title={item.productName}>
                        {item.productName}
                      </td>
                      <td>
                        <div className="ba-due-cell">
                          <div className="ba-due-time">
                            <span>{formatTimeOnly(item.dueDate)}</span>
                            <span className="ba-due-sep">•</span>
                            <span className="ba-due-day">
                              {item.isDueToday ? 'Hôm nay' : `Ngày mai (${formatDateShortVi(item.dueDate)})`}
                            </span>
                          </div>
                          <span
                            className={`ba-due-chip ${
                              item.isDueToday ? 'ba-due-chip--warning' : 'ba-due-chip--info'
                            }`}
                          >
                            Còn {item.hoursRemaining}h
                          </span>
                        </div>
                      </td>
                      <td className="ba-deposit-cell">
                        <strong className="ba-deposit-val">{formatVnd(item.depositAmount)}</strong>
                      </td>
                      <td className="ba-action-cell">
                        <Link to="/branch/returns" className="ba-link-action">
                          <span>Nhận trả</span>
                          <ArrowRight size={13} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {/* Cảnh báo vận hành & Sự cố */}
        <article className="ba-card" aria-label="Cảnh báo vận hành và sự cố cần xử lý">
          <div className="ba-card__header">
            <div>
              <h2 className="ba-card__title">
                <ShieldAlert size={18} aria-hidden="true" />
                <span>Cảnh Báo Vận Hành & Tác Vụ Cần Xử Lý</span>
              </h2>
              <p className="ba-card__subtitle">
                Đơn trễ hạn, khiếu nại hư hỏng, vận đơn lỗi và phiếu chuyển kho chờ nhận
              </p>
            </div>
          </div>

          {operationalIssues.length === 0 ? (
            <div className="ba-section-empty">
              <CheckCircle2 size={20} color="#2F6F4E" aria-hidden="true" />
              <span>Không có sự cố tồn đọng tại chi nhánh ở thời điểm hiện tại.</span>
            </div>
          ) : (
            <div className="ba-issue-list">
              {operationalIssues.map((issue) => {
                const overdueText =
                  issue.type === 'OVERDUE'
                    ? (issue.overdueDays ? `Trễ hạn trả ${issue.overdueDays} ngày` : (issue.detail || 'Trễ hạn'))
                    : (ISSUE_TYPE_LABELS[issue.type] || issue.type);

                return (
                  <div key={issue.id} className="ba-issue-row">
                    <div className="ba-issue-row__main">
                      <span
                        className={`ba-issue-tag ${
                          issue.severity === 'HIGH' ? 'ba-issue-tag--high' : 'ba-issue-tag--medium'
                        }`}
                      >
                        {overdueText}
                      </span>
                      <strong className="ba-issue-row__code">{issue.orderCode}</strong>
                      <span className="ba-issue-row__sep">•</span>
                      <span className="ba-issue-row__customer" title={issue.detail}>
                        <span>{issue.customerName}</span>
                        {issue.customerPhone && (
                          <a
                            href={`tel:${issue.customerPhone}`}
                            className="ba-issue-row__phone"
                            onClick={(e) => e.stopPropagation()}
                            title={`Gọi điện cho ${issue.customerName}`}
                          >
                            <Phone size={11} aria-hidden="true" />
                            <span>{issue.customerPhone}</span>
                          </a>
                        )}
                      </span>
                    </div>
                    <Link
                      to={issue.actionPath || '/branch/rental-orders'}
                      className="ba-link-action"
                    >
                      <span>Xử lý</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
