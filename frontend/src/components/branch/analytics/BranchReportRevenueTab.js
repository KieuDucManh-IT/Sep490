import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ArrowRight } from 'lucide-react';

const RENTAL_STATUS_LABELS = [
  { key: 'confirmed', label: 'Chờ giao' },
  { key: 'renting', label: 'Đang thuê' },
  { key: 'partially_returned', label: 'Trả một phần' },
  { key: 'overdue', label: 'Quá hạn', alert: true },
  { key: 'returned', label: 'Đã hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const SALES_STATUS_LABELS = [
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'processing', label: 'Đang chuẩn bị' },
  { key: 'shipped', label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
];

function formatVnd(amount) {
  const num = Number(amount || 0);
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} ₫`;
}

export default function BranchReportRevenueTab({
  revenueSeries = [],
  orderBreakdown = {},
  totalRevenue = 0,
}) {
  const [selectedSeriesIdx, setSelectedSeriesIdx] = useState(null);

  const maxSeriesTotal = useMemo(() => {
    const maxVal = revenueSeries.reduce((max, b) => Math.max(max, Number(b.totalRevenue || 0)), 0);
    return maxVal > 0 ? maxVal : 1;
  }, [revenueSeries]);

  const activeBucket = useMemo(() => {
    if (!revenueSeries.length) return null;
    if (selectedSeriesIdx !== null && revenueSeries[selectedSeriesIdx]) {
      return revenueSeries[selectedSeriesIdx];
    }
    return revenueSeries[revenueSeries.length - 1];
  }, [revenueSeries, selectedSeriesIdx]);

  const rentalBreakdown = orderBreakdown?.rental || {};
  const salesBreakdown = orderBreakdown?.sales || {};

  return (
    <div className="ba-tab-content">
      <section className="ba-grid-2-1">
        {/* Biểu đồ dòng tiền */}
        <article className="ba-card">
          <div className="ba-card__header">
            <div>
              <h2 className="ba-card__title">Biểu Đồ Dòng Tiền Chi Nhánh</h2>
              <p className="ba-card__subtitle">
                So sánh doanh thu thuê và doanh thu bán theo từng mốc thời gian thực tế
              </p>
            </div>
            <div className="ba-chart-legend">
              <span className="ba-chart-legend__item">
                <span className="ba-chart-legend__swatch ba-chart-legend__swatch--rental" />
                <span>Doanh thu thuê</span>
              </span>
              <span className="ba-chart-legend__item">
                <span className="ba-chart-legend__swatch ba-chart-legend__swatch--sales" />
                <span>Doanh thu bán</span>
              </span>
            </div>
          </div>

          <div className="ba-chart">
            {totalRevenue === 0 ? (
              <div className="ba-chart__empty">
                <Layers size={24} aria-hidden="true" />
                <span>Chưa phát sinh doanh thu hợp lệ trong khoảng thời gian đã chọn.</span>
              </div>
            ) : (
              <>
                <div className="ba-chart__bars">
                  {revenueSeries.map((bucket, idx) => {
                    const rentalPct = Math.round(
                      (Number(bucket.rentalRevenue || 0) / maxSeriesTotal) * 100
                    );
                    const salesPct = Math.round(
                      (Number(bucket.salesRevenue || 0) / maxSeriesTotal) * 100
                    );
                    return (
                      <button
                        key={bucket.key || idx}
                        type="button"
                        className="ba-chart__col"
                        onMouseEnter={() => setSelectedSeriesIdx(idx)}
                        onFocus={() => setSelectedSeriesIdx(idx)}
                        onClick={() => setSelectedSeriesIdx(idx)}
                        title={`${bucket.fullLabel || bucket.label}: ${formatVnd(
                          bucket.totalRevenue
                        )}`}
                      >
                        <div className="ba-chart__stack">
                          {rentalPct > 0 && (
                            <div
                              className="ba-chart__seg ba-chart__seg--rental"
                              style={{ height: `${Math.max(4, rentalPct)}%` }}
                            />
                          )}
                          {salesPct > 0 && (
                            <div
                              className="ba-chart__seg ba-chart__seg--sales"
                              style={{ height: `${Math.max(4, salesPct)}%` }}
                            />
                          )}
                        </div>
                        <span className="ba-chart__label">{bucket.label}</span>
                      </button>
                    );
                  })}
                </div>

                {activeBucket && (
                  <div className="ba-chart__inspector">
                    <strong>{activeBucket.fullLabel || activeBucket.label}</strong>
                    <span>
                      Thuê: <strong>{formatVnd(activeBucket.rentalRevenue)}</strong> (
                      {activeBucket.rentalCount || 0} đơn)
                    </span>
                    <span>
                      Bán: <strong>{formatVnd(activeBucket.salesRevenue)}</strong> (
                      {activeBucket.salesCount || 0} đơn)
                    </span>
                    <span>
                      Tổng: <strong>{formatVnd(activeBucket.totalRevenue)}</strong>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </article>

        {/* Tổng hợp trạng thái đơn */}
        <article className="ba-card">
          <div className="ba-card__header">
            <div>
              <h2 className="ba-card__title">Tổng Hợp Trạng Thái Đơn</h2>
              <p className="ba-card__subtitle">
                Loại trừ đơn nháp (draft) khỏi thống kê hiệu suất
              </p>
            </div>
          </div>

          <div className="ba-order-groups">
            <div className="ba-order-group">
              <div className="ba-order-group__head">
                <span>Đơn Thuê Trang Phục</span>
                <Link to="/branch/rental-orders" className="ba-link-action">
                  <span>Quản lý</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
              <div className="ba-status-grid">
                {RENTAL_STATUS_LABELS.map((item) => {
                  const count = Number(rentalBreakdown[item.key] || 0);
                  return (
                    <div
                      key={item.key}
                      className={`ba-status-tile ${
                        item.alert && count > 0 ? 'ba-status-tile--alert' : ''
                      }`}
                    >
                      <span className="ba-status-tile__label">{item.label}</span>
                      <span className="ba-status-tile__count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ba-order-group">
              <div className="ba-order-group__head">
                <span>Đơn Bán Đứt</span>
                <Link to="/branch/sale-orders" className="ba-link-action">
                  <span>Quản lý</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
              <div className="ba-status-grid">
                {SALES_STATUS_LABELS.map((item) => (
                  <div key={item.key} className="ba-status-tile">
                    <span className="ba-status-tile__label">{item.label}</span>
                    <span className="ba-status-tile__count">
                      {Number(salesBreakdown[item.key] || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
