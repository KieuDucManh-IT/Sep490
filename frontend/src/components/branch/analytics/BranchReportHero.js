import React from 'react';
import {
  Building2,
  MapPin,
  RefreshCw,
  Download,
  Printer,
  Calendar,
  ShieldAlert,
  TrendingUp,
  Package,
  Layers,
} from 'lucide-react';

const PRESET_OPTIONS = [
  { key: 'TODAY', label: 'Hôm nay' },
  { key: 'WEEK', label: 'Tuần này' },
  { key: 'MONTH', label: 'Tháng này' },
  { key: 'QUARTER', label: 'Quý này' },
  { key: 'YEAR', label: 'Năm nay' },
  { key: 'CUSTOM', label: 'Tùy chỉnh' },
];

function formatDateVi(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const TABS_CONFIG = [
  { key: 'OPERATIONS', label: 'Tiêu điểm vận hành', icon: ShieldAlert, badgeType: 'alert' },
  { key: 'REVENUE', label: 'Doanh thu & Dòng tiền', icon: TrendingUp },
  { key: 'INVENTORY', label: 'Kho quầy & Sản phẩm', icon: Package },
  { key: 'ALL', label: 'Toàn cảnh báo cáo', icon: Layers },
];

export default function BranchReportHero({
  report,
  timeRange,
  onSelectPreset,
  customStartInput,
  setCustomStartInput,
  customEndInput,
  setCustomEndInput,
  onApplyCustomRange,
  onRefresh,
  onExportCsv,
  onPrintPdf,
  refreshing,
  activeTab,
  setActiveTab,
  urgentOpsCount = 0,
}) {
  const branchInfo = report?.branchInfo;
  const storeLocation = report?.storeLocation;

  return (
    <section className="ba-hero" aria-label="Tiêu đề, bộ lọc và điều hướng báo cáo chi nhánh">
      <div className="ba-hero__top">
        <div className="ba-hero__branding">
          <div className="ba-hero__eyebrow">
            <Building2 size={14} aria-hidden="true" />
            <span>Vestora Fashion Rental & Resale • Quản lý chi nhánh</span>
          </div>
          <h1 className="ba-hero__title">
            {branchInfo?.name || 'Hiệu Suất Hoạt Động Chi Nhánh'}
          </h1>
          <div className="ba-hero__meta">
            {branchInfo && (
              <>
                <span className="ba-hero__meta-item">
                  <MapPin size={14} aria-hidden="true" />
                  <span>
                    {[branchInfo.address, branchInfo.ward, branchInfo.city]
                      .filter(Boolean)
                      .join(', ') || 'Chưa cập nhật địa chỉ'}
                  </span>
                </span>
                <span
                  className={`ba-badge ${
                    branchInfo.status === 'ACTIVE' ? 'ba-badge--success' : 'ba-badge--warning'
                  }`}
                >
                  {branchInfo.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}
                </span>
                {branchInfo.isHQ && <span className="ba-badge ba-badge--gold">Trụ sở chính</span>}
              </>
            )}
            {storeLocation && (
              <span className="ba-badge ba-badge--gold">
                Kho cửa hàng: {storeLocation.name} ({storeLocation.code})
              </span>
            )}
          </div>
        </div>

        <div className="ba-hero__actions ba-print-hide">
          <button
            type="button"
            className="ba-btn ba-btn--outline"
            onClick={onRefresh}
            disabled={refreshing}
            title="Tải lại số liệu mới nhất"
          >
            <RefreshCw size={15} className={refreshing ? 'ba-spin' : ''} aria-hidden="true" />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            className="ba-btn ba-btn--outline"
            onClick={onExportCsv}
            disabled={!report || !report.hasAssignment}
            title="Xuất file Excel/CSV"
          >
            <Download size={15} aria-hidden="true" />
            <span>Xuất CSV</span>
          </button>
          <button
            type="button"
            className="ba-btn ba-btn--outline"
            onClick={onPrintPdf}
            disabled={!report || !report.hasAssignment}
            title="Mở hộp thoại in hoặc xuất PDF"
          >
            <Printer size={15} aria-hidden="true" />
            <span>In / Lưu PDF</span>
          </button>
        </div>
      </div>

      <div className="ba-toolbar ba-print-hide">
        <div className="ba-presets" role="group" aria-label="Chọn kỳ báo cáo">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`ba-presets__btn ${timeRange === opt.key ? 'ba-presets__btn--active' : ''}`}
              onClick={() => onSelectPreset(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {timeRange === 'CUSTOM' ? (
          <form className="ba-custom-range" onSubmit={onApplyCustomRange}>
            <label className="ba-date-field">
              <span>Từ</span>
              <input
                type="date"
                className="ba-date-field__input"
                value={customStartInput}
                onChange={(e) => setCustomStartInput(e.target.value)}
                aria-label="Ngày bắt đầu"
              />
            </label>
            <label className="ba-date-field">
              <span>Đến</span>
              <input
                type="date"
                className="ba-date-field__input"
                value={customEndInput}
                onChange={(e) => setCustomEndInput(e.target.value)}
                aria-label="Ngày kết thúc"
              />
            </label>
            <button type="submit" className="ba-btn ba-btn--gold">
              Áp dụng
            </button>
          </form>
        ) : (
          <div className="ba-window-label">
            <Calendar size={14} aria-hidden="true" />
            <span>
              Kỳ dữ liệu: {formatDateVi(report?.timeRange?.startDate)} —{' '}
              {formatDateVi(report?.timeRange?.endDate)}
            </span>
          </div>
        )}
      </div>

      {/* Haute Couture Segmented Tabs Navigation */}
      {report && report.hasAssignment && (
        <nav className="ba-nav-tabs ba-print-hide" aria-label="Phân loại nội dung báo cáo">
          {TABS_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ba-nav-tab ${isActive ? 'ba-nav-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="ba-nav-tab__label">{tab.label}</span>
                {tab.key === 'OPERATIONS' && urgentOpsCount > 0 && (
                  <span className="ba-nav-tab__badge ba-nav-tab__badge--alert">
                    {urgentOpsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
    </section>
  );
}
