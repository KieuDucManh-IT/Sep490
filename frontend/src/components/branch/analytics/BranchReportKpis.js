import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingBag,
  Wallet,
  RotateCcw,
} from 'lucide-react';

function formatVnd(amount) {
  const num = Number(amount || 0);
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} ₫`;
}

export default function BranchReportKpis({ kpi = {} }) {
  const totalRevenue = Number(kpi.totalRevenue || 0);
  const rentalRevenue = Number(kpi.rentalRevenue || 0);
  const salesRevenue = Number(kpi.salesRevenue || 0);
  const rentalSharePct = totalRevenue > 0 ? Math.round((rentalRevenue / totalRevenue) * 100) : 0;
  const salesSharePct = totalRevenue > 0 ? 100 - rentalSharePct : 0;

  return (
    <section className="ba-kpi-grid" aria-label="Chỉ số hiệu suất chính">
      {/* KPI 1: Tổng doanh thu */}
      <article className="ba-kpi-card ba-kpi-card--featured">
        <div className="ba-kpi-card__head">
          <span className="ba-kpi-card__label">Tổng Doanh Thu Kỳ</span>
          <span className="ba-kpi-card__icon" aria-hidden="true">
            <TrendingUp size={17} />
          </span>
        </div>
        <div className="ba-kpi-card__value">{formatVnd(totalRevenue)}</div>
        <div className="ba-kpi-card__foot">
          {kpi.hasGrowthBaseline ? (
            <span
              className={`ba-badge ${
                Number(kpi.growthRate) >= 0 ? 'ba-badge--success' : 'ba-badge--danger'
              }`}
            >
              {Number(kpi.growthRate) >= 0 ? (
                <TrendingUp size={12} aria-hidden="true" />
              ) : (
                <TrendingDown size={12} aria-hidden="true" />
              )}
              <span>
                {Number(kpi.growthRate) >= 0 ? `+${kpi.growthRate}%` : `${kpi.growthRate}%`} so với kỳ trước
              </span>
            </span>
          ) : (
            <span className="ba-badge ba-badge--gold">
              <Minus size={12} aria-hidden="true" />
              <span>Chưa có dữ liệu kỳ trước</span>
            </span>
          )}
        </div>
      </article>

      {/* KPI 2: Phân tách nguồn thu */}
      <article className="ba-kpi-card">
        <div className="ba-kpi-card__head">
          <span className="ba-kpi-card__label">Phân Tách Doanh Thu</span>
          <span className="ba-kpi-card__icon" aria-hidden="true">
            <ShoppingBag size={17} />
          </span>
        </div>
        <div className="ba-kpi-card__split">
          <div className="ba-kpi-card__split-row">
            <span>Cho thuê ({rentalSharePct}%)</span>
            <span className="ba-kpi-card__split-val">{formatVnd(rentalRevenue)}</span>
          </div>
          <div className="ba-kpi-card__split-row">
            <span>Bán đứt ({salesSharePct}%)</span>
            <span className="ba-kpi-card__split-val">{formatVnd(salesRevenue)}</span>
          </div>
          <div className="ba-split-bar" aria-hidden="true">
            <div className="ba-split-bar__rental" style={{ width: `${rentalSharePct}%` }} />
            <div className="ba-split-bar__sales" style={{ width: `${salesSharePct}%` }} />
          </div>
        </div>
      </article>

      {/* KPI 3: Tiền cọc đang tạm giữ */}
      <article className="ba-kpi-card">
        <div className="ba-kpi-card__head">
          <span className="ba-kpi-card__label">Tiền Cọc Đang Tạm Giữ</span>
          <span className="ba-kpi-card__icon" aria-hidden="true">
            <Wallet size={17} />
          </span>
        </div>
        <div className="ba-kpi-card__value">{formatVnd(kpi.heldDeposits)}</div>
        <div className="ba-kpi-card__foot">
          <span>{kpi.activeRentalsCount || 0} đơn đang thuê</span>
          {Number(kpi.overdueRentalsCount || 0) > 0 && (
            <span className="ba-badge ba-badge--danger">
              {kpi.overdueRentalsCount} quá hạn
            </span>
          )}
        </div>
      </article>

      {/* KPI 4: Đơn hàng & Xoay vòng */}
      <article className="ba-kpi-card">
        <div className="ba-kpi-card__head">
          <span className="ba-kpi-card__label">Đơn Hàng & Xoay Vòng</span>
          <span className="ba-kpi-card__icon" aria-hidden="true">
            <RotateCcw size={17} />
          </span>
        </div>
        <div className="ba-kpi-card__value">{kpi.totalOrdersCount || 0} đơn</div>
        <div className="ba-kpi-card__foot">
          <span>
            {kpi.rentalOrdersCount || 0} thuê • {kpi.salesOrdersCount || 0} bán
          </span>
          <span className="ba-badge ba-badge--neutral">
            {kpi.turnoverRate ?? 0} lượt/sp
          </span>
        </div>
      </article>
    </section>
  );
}
