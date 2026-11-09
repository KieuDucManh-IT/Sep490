import React from 'react';
import {
  CalendarRange,
  ShoppingBag,
  Clock,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Coins,
  Package,
} from 'lucide-react';
import { formatCurrency } from './orderUtils';
import '../../styles/ShopBranches.css';
import '../../styles/OrderMonitoring.css';

export default function OrderKpiCards({
  type = 'rental',
  metrics,
  isChainScope = true,
  branchName = '',
  loading = false,
}) {
  const scopeLabel = isChainScope
    ? 'Toàn bộ cửa hàng'
    : branchName
    ? `Chi nhánh ${branchName}`
    : 'Chi nhánh đang chọn';

  if (loading) {
    return (
      <div className="clean-kpi-grid mb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="clean-kpi-card">
            <div className="order-skeleton" style={{ width: '38px', height: '38px', borderRadius: '8px' }} />
            <div className="clean-kpi-info flex-grow-1">
              <div className="order-skeleton" style={{ width: '80px', height: '12px', marginBottom: '6px' }} />
              <div className="order-skeleton" style={{ width: '50px', height: '22px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 1. Rental Orders KPI
  if (type === 'rental') {
    const m = metrics || {};
    return (
      <div className="clean-kpi-grid mb-3">
        <div className="clean-kpi-card">
          <div className="clean-kpi-icon">
            <CalendarRange size={18} />
          </div>
          <div className="clean-kpi-info">
            <span className="clean-kpi-label">Tổng Đơn Thuê</span>
            <span className="clean-kpi-value">
              {m.total !== undefined ? String(m.total).padStart(2, '0') : '—'}
            </span>
            <span className="clean-kpi-desc">
              {scopeLabel} • Tiền thuê: {formatCurrency(m.totalRentalFee)}
            </span>
          </div>
        </div>

        <div className="clean-kpi-card">
          <div className="clean-kpi-icon" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
            <Clock size={18} />
          </div>
          <div className="clean-kpi-info">
            <span className="clean-kpi-label">Đang Cho Thuê</span>
            <span className="clean-kpi-value" style={{ color: '#1D4ED8' }}>
              {m.renting !== undefined ? String(m.renting).padStart(2, '0') : '—'}
            </span>
            <span className="clean-kpi-desc">Khách đang giữ trang phục</span>
          </div>
        </div>

        <div className="clean-kpi-card">
          <div className="clean-kpi-icon" style={{ background: '#FEF2F2', color: '#DC2626' }}>
            <AlertTriangle size={18} />
          </div>
          <div className="clean-kpi-info">
            <span className="clean-kpi-label">Đơn Quá Hạn Trả</span>
            <span className="clean-kpi-value" style={{ color: '#DC2626' }}>
              {m.overdue !== undefined ? String(m.overdue).padStart(2, '0') : '—'}
            </span>
            <span className="clean-kpi-desc">Cần liên hệ khách hoàn trả</span>
          </div>
        </div>

        <div className="clean-kpi-card">
          <div className="clean-kpi-icon" style={{ background: '#F0FDF4', color: '#15803D' }}>
            <ShieldCheck size={18} />
          </div>
          <div className="clean-kpi-info">
            <span className="clean-kpi-label">Tiền Cọc Đang Giữ</span>
            <span className="clean-kpi-value" style={{ color: '#15803D', fontSize: '18px' }}>
              {formatCurrency(m.totalEscrowHeld ?? m.totalDepositHeld ?? m.totalDepositAmount)}
            </span>
            <span className="clean-kpi-desc">Bảo đảm an toàn cho trang phục</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Sale Orders KPI
  const m = metrics || {};
  return (
    <div className="clean-kpi-grid mb-3">
      <div className="clean-kpi-card">
        <div className="clean-kpi-icon">
          <ShoppingBag size={18} />
        </div>
        <div className="clean-kpi-info">
          <span className="clean-kpi-label">Tổng Đơn Mua</span>
          <span className="clean-kpi-value">
            {m.total !== undefined ? String(m.total).padStart(2, '0') : '—'}
          </span>
          <span className="clean-kpi-desc">
            {scopeLabel} • Doanh thu: {formatCurrency(m.completedRevenue ?? m.totalRevenue ?? m.totalAmount)}
          </span>
        </div>
      </div>

      <div className="clean-kpi-card">
        <div className="clean-kpi-icon" style={{ background: '#FFFBEB', color: '#B45309' }}>
          <Package size={18} />
        </div>
        <div className="clean-kpi-info">
          <span className="clean-kpi-label">Chờ Xử Lý & Gói Hàng</span>
          <span className="clean-kpi-value" style={{ color: '#B45309' }}>
            {(m.confirmed || 0) + (m.processing || 0) > 0
              ? String((m.confirmed || 0) + (m.processing || 0)).padStart(2, '0')
              : '00'}
          </span>
          <span className="clean-kpi-desc">Cần chuẩn bị & giao cho khách</span>
        </div>
      </div>

      <div className="clean-kpi-card">
        <div className="clean-kpi-icon" style={{ background: '#F0FDF4', color: '#15803D' }}>
          <CheckCircle2 size={18} />
        </div>
        <div className="clean-kpi-info">
          <span className="clean-kpi-label">Đã Giao Thành Công</span>
          <span className="clean-kpi-value" style={{ color: '#15803D' }}>
            {m.completed !== undefined ? String(m.completed).padStart(2, '0') : '—'}
          </span>
          <span className="clean-kpi-desc">Đơn mua hoàn tất</span>
        </div>
      </div>

      <div className="clean-kpi-card">
        <div className="clean-kpi-icon" style={{ background: '#F8FAFC', color: '#475569' }}>
          <Coins size={18} />
        </div>
        <div className="clean-kpi-info">
          <span className="clean-kpi-label">Doanh Thu Bán Hàng</span>
          <span className="clean-kpi-value" style={{ color: '#0F172A', fontSize: '18px' }}>
            {formatCurrency(m.completedRevenue ?? m.totalRevenue ?? m.totalAmount)}
          </span>
          <span className="clean-kpi-desc">Doanh thu bán thời trang</span>
        </div>
      </div>
    </div>
  );
}

