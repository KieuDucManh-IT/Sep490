import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import {
  getAdminShopsStatsApi,
  getAdminShopsListApi,
  toggleSuspendShopApi,
} from '../../services/shopApi';
import '../../styles/AdminShops.css';

const getAdminId = () => {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u._id || u.UserId || u.id) return String(u._id || u.UserId || u.id);
    }
  } catch (_) {}
  return process.env.REACT_APP_ADMIN_ID || null;
};

const STATUS_TABS = [
  { key: 'ALL',       label: 'Tất cả Chi Nhánh' },
  { key: 'ACTIVE',    label: 'Đang Hoạt Động' },
  { key: 'SUSPENDED', label: 'Tạm Ngưng' },
];

const CITIES = [
  { value: 'ALL', label: 'Tất cả Tỉnh / TP' },
  { value: 'Hà Nội', label: 'Hà Nội' },
  { value: 'Hồ Chí Minh', label: 'TP. Hồ Chí Minh' },
  { value: 'Đà Nẵng', label: 'Đà Nẵng' },
  { value: 'Hải Phòng', label: 'Hải Phòng' },
  { value: 'Cần Thơ', label: 'Cần Thơ' },
];

function DocPreviewModal({ doc, onClose }) {
  if (!doc) return null;

  return (
    <div className="admin-modal-overlay admin-doc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-box admin-doc-modal">
        <div className="admin-modal-header">
          <div>
            <div className="admin-modal-header-tag" style={{ color: '#059669' }}>XEM TÀI LIỆU THẨM ĐỊNH</div>
            <h5 className="admin-modal-header-title">{doc.label} — {doc.shopName}</h5>
          </div>
          <button className="admin-modal-close-btn" onClick={onClose} title="Đóng">✕</button>
        </div>

        <div className="admin-modal-body">
          <div className="admin-doc-file-meta">
            <span>Tên tệp: <strong>{doc.filename || 'Tài liệu thẩm định'}</strong></span>
            <span style={{ color: '#059669', fontWeight: 600 }}>Tài liệu xác thực gian hàng</span>
          </div>

          <div className="admin-doc-preview-area">
            {doc.url ? (
              doc.url.startsWith('data:application/pdf') ? (
                <iframe src={doc.url} title="PDF Viewer" width="100%" height="450px" style={{ border: 'none' }} />
              ) : (
                <img src={doc.url} alt={doc.label} className="admin-doc-preview-img" />
              )
            ) : (
              <div style={{ textAlign: 'center', color: '#737373', padding: '40px 20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                <div>Chưa có file hoặc tài liệu đang ở dạng liên kết nội bộ.</div>
              </div>
            )}
          </div>
        </div>

        <div className="admin-modal-footer">
          {doc.url && (
            <a
              href={doc.url}
              download={doc.filename || 'tai-lieu.pdf'}
              target="_blank"
              rel="noreferrer"
              className="btn-modal-cancel"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              Tải tệp xuống
            </a>
          )}
          <button className="btn-modal-cancel" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ app, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 5) return;
    setLoading(true);
    await onConfirm(app._id, reason.trim(), notes.trim());
    setLoading(false);
  };

  return (
    <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-box">
        <div className="admin-modal-header">
          <div>
            <div className="admin-modal-header-tag">TỪ CHỐI HỒ SƠ GIAN HÀNG</div>
            <h5 className="admin-modal-header-title">{app.name}</h5>
          </div>
          <button className="admin-modal-close-btn" onClick={onClose} title="Đóng">✕</button>
        </div>

        <div className="admin-modal-body">
          <div>
            <label className="admin-modal-label">
              Lý do từ chối <span className="req">*</span>
            </label>
            <textarea
              className={`admin-modal-textarea ${(!reason.trim() || reason.trim().length < 5) ? 'error' : ''}`}
              rows={3}
              placeholder="Mô tả cụ thể lý do từ chối để gửi thông báo cho chủ gian hàng..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {(!reason.trim() || reason.trim().length < 5) && (
              <div className="admin-modal-error-text">
                Vui lòng nhập lý do từ chối cụ thể (tối thiểu 5 ký tự) để thông báo đến chủ gian hàng.
              </div>
            )}
          </div>

          <div>
            <label className="admin-modal-label">Ghi chú nội bộ thẩm định</label>
            <textarea
              className="admin-modal-textarea"
              rows={2}
              placeholder="Ghi chú thêm cho kiểm duyệt viên hoặc quản trị hệ thống..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-modal-cancel" onClick={onClose} disabled={loading}>Hủy</button>
          <button
            className="btn-modal-danger"
            onClick={handleSubmit}
            disabled={loading || !reason.trim() || reason.trim().length < 5}
          >
            {loading ? 'Đang xử lý...' : 'Xác Nhận Từ Chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuspendModal({ app, onClose, onConfirm }) {
  const [reason, setReason] = useState('Vi phạm quy định nền tảng về chất lượng hàng hóa');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const PRESET_REASONS = [
    'Vi phạm quy định nền tảng về chất lượng hàng hóa / mô tả sai lệch',
    'Tranh chấp tiền cọc hoặc khiếu nại khách hàng chưa xử lý',
    'Chủ gian hàng tạm thời yêu cầu đóng cửa để kiểm kê kho',
    'Địa chỉ hoặc giấy phép kinh doanh cần xác minh bổ sung',
    'Khác (nhập chi tiết lý do bên dưới)',
  ];

  const handleSubmit = async () => {
    const finalReason = reason.startsWith('Khác')
      ? customReason.trim()
      : (customReason.trim() ? `${reason} — ${customReason.trim()}` : reason);

    if (!finalReason) return;
    setLoading(true);
    await onConfirm(app._id, finalReason, notes.trim());
    setLoading(false);
  };

  if (!app) return null;

  return (
    <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-box">
        <div className="admin-modal-header">
          <div>
            <div className="admin-modal-header-tag" style={{ color: '#D97706' }}>TẠM NGƯNG VẬN HÀNH GIAN HÀNG</div>
            <h5 className="admin-modal-header-title">{app.name}</h5>
          </div>
          <button className="admin-modal-close-btn" onClick={onClose} title="Đóng">✕</button>
        </div>

        <div className="admin-modal-body">
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', color: '#92400E', marginBottom: '16px' }}>
            ⚠️ <strong>Cảnh báo vận hành:</strong> Khi tạm ngưng, các sản phẩm của gian hàng sẽ tạm thời bị ẩn khỏi sàn thương mại Vestora và khách hàng không thể tạo đơn thuê/mua mới cho đến khi gian hàng được kích hoạt lại.
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label className="admin-modal-label">Lý do tạm ngưng <span className="req">*</span></label>
            <select
              className="admin-shops-select-filter"
              style={{ width: '100%', marginBottom: '8px' }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {PRESET_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <textarea
              className="admin-modal-textarea"
              rows={2}
              placeholder="Chi tiết lý do tạm ngưng (bắt buộc nếu chọn Khác)..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          </div>

          <div>
            <label className="admin-modal-label">Ghi chú nội bộ cho Operations Staff</label>
            <textarea
              className="admin-modal-textarea"
              rows={2}
              placeholder="Ghi chú điều kiện hoặc hướng xử lý để mở lại gian hàng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-modal-cancel" onClick={onClose} disabled={loading}>Hủy</button>
          <button
            className="btn-modal-danger"
            style={{ background: '#D97706', borderColor: '#D97706' }}
            onClick={handleSubmit}
            disabled={loading || (reason.startsWith('Khác') && !customReason.trim())}
          >
            {loading ? 'Đang xử lý...' : 'Xác Nhận Tạm Ngưng'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReactivateModal({ app, onClose, onConfirm }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await onConfirm(app._id, notes.trim());
    setLoading(false);
  };

  if (!app) return null;

  return (
    <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-box">
        <div className="admin-modal-header">
          <div>
            <div className="admin-modal-header-tag" style={{ color: '#059669' }}>KÍCH HOẠT LẠI GIAN HÀNG</div>
            <h5 className="admin-modal-header-title">{app.name}</h5>
          </div>
          <button className="admin-modal-close-btn" onClick={onClose} title="Đóng">✕</button>
        </div>

        <div className="admin-modal-body">
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', color: '#065F46', marginBottom: '16px' }}>
            ✓ Gian hàng sẽ được khôi phục trạng thái <strong>ĐANG HOẠT ĐỘNG</strong> trên sàn Vestora. Người dùng có thể tìm kiếm sản phẩm và đặt thuê/mua bình thường.
          </div>

          {app.rejectionReason && (
            <div style={{ background: '#F5F3EF', border: '1px solid #ECEAE5', padding: '12px 16px', borderRadius: '10px', fontSize: '12.5px', marginBottom: '14px' }}>
              <strong>Lý do tạm ngưng trước đó:</strong> {app.rejectionReason}
            </div>
          )}

          <div>
            <label className="admin-modal-label">Ghi chú khôi phục hoạt động</label>
            <textarea
              className="admin-modal-textarea"
              rows={3}
              placeholder="Ghi chú xác nhận đã khắc phục vi phạm hoặc hoàn tất thẩm định..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-modal-cancel" onClick={onClose} disabled={loading}>Hủy</button>
          <button
            className="btn-modal-approve"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : 'Xác Nhận Kích Hoạt Lại'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopDetailModal({ app, onClose, onSuspend, onReactivate, onApprove, onReject, onViewDoc }) {
  if (!app) return null;

  const owner = app.ownerId || {};
  const ownerName = owner.FullName || owner.fullName || app.ownerName || 'Chưa cập nhật';
  const ownerEmail = owner.Email || owner.email || app.ownerEmail || '—';
  const ownerPhone = app.phone || owner.Information?.[0]?.Phone || owner.phone || '—';
  const ownerRole = owner.Role || owner.role || 'CUSTOMER';
  const ownerStatus = owner.Status || owner.status || 'ACTIVE';
  const fullAddress = [app.address, app.ward, app.district, app.city].filter(Boolean).join(', ') || 'Chưa cập nhật';
  const hasGps = app.latitude != null && app.longitude != null && !isNaN(Number(app.latitude)) && !isNaN(Number(app.longitude));

  const statusMap = {
    ACTIVE: { label: 'Đang Hoạt Động', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
    SUSPENDED: { label: 'Tạm Ngưng Vận Hành', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    PENDING: { label: 'Chờ Thẩm Định', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
    REJECTED: { label: 'Đã Từ Chối', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  };
  const currentStatus = statusMap[app.status] || { label: app.status, color: '#737373', bg: '#F5F5F5', border: '#E5E5E5' };

  return (
    <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-box admin-applicant-modal" style={{ maxWidth: '780px' }}>
        <div className="admin-modal-header">
          <div>
            <div className="admin-modal-header-tag" style={{ color: currentStatus.color }}>
              HỒ SƠ VẬN HÀNH GIAN HÀNG — {currentStatus.label.toUpperCase()}
            </div>
            <h5 className="admin-modal-header-title">{app.name}</h5>
          </div>
          <button className="admin-modal-close-btn" onClick={onClose} title="Đóng">✕</button>
        </div>

        <div className="admin-modal-body">
          {/* Shop Header Banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#FAF9F6', borderRadius: '12px', border: '1px solid #ECEAE5', marginBottom: '20px' }}>
            <img
              src={app.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.name)}&background=141414&color=fff&size=100`}
              alt={app.name}
              style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #E5E5E5' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#171717' }}>{app.name}</h3>
                <span style={{ background: currentStatus.bg, color: currentStatus.color, border: `1px solid ${currentStatus.border}`, borderRadius: '20px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 600 }}>
                  ● {currentStatus.label}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#737373' }}>
                {app.description || 'Chưa có mô tả gian hàng'}
              </p>
            </div>
          </div>

          {/* Grid Information */}
          <div className="admin-applicant-grid" style={{ marginBottom: '20px' }}>
            <div className="admin-applicant-field">
              <span className="admin-applicant-field__label">CHỦ SỞ HỮU GIAN HÀNG</span>
              <span className="admin-applicant-field__val">{ownerName}</span>
            </div>
            <div className="admin-applicant-field">
              <span className="admin-applicant-field__label">VAI TRÒ / TRẠNG THÁI TÀI KHOẢN</span>
              <span className="admin-applicant-field__val">
                {ownerRole} ({ownerStatus})
              </span>
            </div>
            <div className="admin-applicant-field">
              <span className="admin-applicant-field__label">SỐ ĐIỆN THOẠI LIÊN HỆ</span>
              <span className="admin-applicant-field__val">{ownerPhone}</span>
            </div>
            <div className="admin-applicant-field">
              <span className="admin-applicant-field__label">EMAIL CHỦ GIAN HÀNG</span>
              <span className="admin-applicant-field__val regular">{ownerEmail}</span>
            </div>
            <div className="admin-applicant-field" style={{ gridColumn: 'span 2' }}>
              <span className="admin-applicant-field__label">ĐỊA CHỈ TRỤ SỞ / CỬA HÀNG</span>
              <span className="admin-applicant-field__val regular">{fullAddress}</span>
              {hasGps && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📍 GPS: {Number(app.latitude).toFixed(4)}, {Number(app.longitude).toFixed(4)}</span>
                  <a
                    href={`https://www.google.com/maps?q=${app.latitude},${app.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#2563EB', textDecoration: 'underline', fontSize: '11.5px' }}
                  >
                    Xem trên Google Maps ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Verification Documents */}
          <div style={{ marginBottom: '20px' }}>
            <div className="admin-doc-section-title" style={{ marginBottom: '10px' }}>HỒ SƠ PHÁP LÝ & GIẤY TỜ THẨM ĐỊNH</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {app.businessLicenseUrl && (
                <button
                  type="button"
                  className="btn-detail-action"
                  style={{ justifyContent: 'center', padding: '10px' }}
                  onClick={() => onViewDoc({
                    label: 'Giấy Phép Đăng Ký Kinh Doanh (ĐKKD)',
                    filename: 'GPKD_Document.pdf',
                    url: app.businessLicenseUrl,
                    shopName: app.name,
                  })}
                >
                  📄 Xem Giấy ĐKKD
                </button>
              )}
              {app.idCardFrontUrl && (
                <button
                  type="button"
                  className="btn-detail-action"
                  style={{ justifyContent: 'center', padding: '10px' }}
                  onClick={() => onViewDoc({
                    label: 'Căn Cước Công Dân (CCCD) — Mặt Trước',
                    filename: 'CCCD_Mat_Truoc.jpg',
                    url: app.idCardFrontUrl,
                    shopName: app.name,
                  })}
                >
                  🪪 Xem CCCD Mặt Trước
                </button>
              )}
              {app.idCardBackUrl && (
                <button
                  type="button"
                  className="btn-detail-action"
                  style={{ justifyContent: 'center', padding: '10px' }}
                  onClick={() => onViewDoc({
                    label: 'Căn Cước Công Dân (CCCD) — Mặt Sau',
                    filename: 'CCCD_Mat_Sau.jpg',
                    url: app.idCardBackUrl,
                    shopName: app.name,
                  })}
                >
                  🪪 Xem CCCD Mặt Sau
                </button>
              )}
            </div>
          </div>

          {/* Audit Trail & Notes */}
          {(app.rejectionReason || app.notes || app.reviewedAt) && (
            <div style={{ background: '#FAF8F5', border: '1px solid #ECEAE5', borderRadius: '12px', padding: '14px 18px', fontSize: '13px' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#737373', textTransform: 'uppercase', marginBottom: '8px' }}>
                LỊCH SỬ THẨM ĐỊNH & GHI CHÚ KIỂM SOÁT
              </div>
              {app.reviewedAt && (
                <div style={{ marginBottom: '6px', color: '#525252' }}>
                  <strong>Thời gian xử lý:</strong> {new Date(app.reviewedAt).toLocaleString('vi-VN')}
                </div>
              )}
              {app.rejectionReason && (
                <div style={{ marginBottom: '6px', color: app.status === 'SUSPENDED' ? '#B45309' : '#DC2626' }}>
                  <strong>{app.status === 'SUSPENDED' ? 'Lý do tạm ngưng:' : 'Lý do từ chối:'}</strong> {app.rejectionReason}
                </div>
              )}
              {app.notes && (
                <div style={{ color: '#525252' }}>
                  <strong>Ghi chú nội bộ:</strong> {app.notes}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="admin-modal-footer">
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Đóng
          </button>

          {app.status === 'ACTIVE' && (
            <button
              type="button"
              className="btn-suspend-action"
              style={{ padding: '9px 18px' }}
              onClick={() => {
                onClose();
                onSuspend(app);
              }}
            >
              ⏸ Tạm Ngưng Gian Hàng
            </button>
          )}

          {app.status === 'SUSPENDED' && (
            <button
              type="button"
              className="btn-reactivate-action"
              style={{ padding: '9px 18px' }}
              onClick={() => {
                onClose();
                onReactivate(app);
              }}
            >
              ▶ Kích Hoạt Lại Gian Hàng
            </button>
          )}

          {app.status === 'PENDING' && (
            <>
              <button
                type="button"
                className="btn-modal-danger"
                onClick={() => {
                  onClose();
                  onReject(app);
                }}
              >
                Từ Chối
              </button>
              <button
                type="button"
                className="btn-modal-approve"
                onClick={() => {
                  onClose();
                  onApprove(app);
                }}
              >
                Phê Duyệt
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ApplicantDetailModal({ app, onClose, onApprove, onReject, onViewDoc }) {
  const [copiedId, setCopiedId] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  if (!app) return null;

  const owner = app.ownerId || {};
  const ownerName = owner.FullName || owner.fullName || app.ownerName || 'Chưa cập nhật';
  const ownerEmail = owner.Email || owner.email || app.ownerEmail || '—';
  const ownerPhone = app.phone || owner.Information?.[0]?.Phone || owner.phone || '—';
  const ownerIdString = owner._id || owner.UserId || owner.userId || (typeof app.ownerId === 'string' ? app.ownerId : '—');
  const ownerRole = owner.Role || owner.role || 'CUSTOMER';
  const ownerStatus = owner.Status || owner.status || 'ACTIVE';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=141414&color=fff&size=128`;

  const copyUserId = () => {
    if (ownerIdString && ownerIdString !== '—') {
      navigator.clipboard?.writeText(String(ownerIdString));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    await onApprove(app, approvalNotes);
    setApproving(false);
    onClose();
  };

  const handleReject = () => {
    onClose();
    onReject(app);
  };

  const fullAddress = [app.address, app.ward, app.district, app.city].filter(Boolean).join(', ') || 'Chưa cập nhật';
  const hasGps = app.latitude != null && app.longitude != null && !isNaN(Number(app.latitude)) && !isNaN(Number(app.longitude));

  const statusMap = {
    PENDING: { label: 'Chờ thẩm định', dot: '#059669' },
    ACTIVE: { label: 'Đã phê duyệt', dot: '#2563EB' },
    REJECTED: { label: 'Đã từ chối', dot: '#DC2626' },
    SUSPENDED: { label: 'Tạm ngưng', dot: '#D97706' },
  };
  const currentStatus = statusMap[app.status] || { label: app.status, dot: '#737373' };

  return (
    <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-box admin-applicant-modal">
        <div className="admin-modal-header">
          <div>
            <div className="admin-modal-header-tag" style={{ color: '#A6865A' }}>
              THẨM ĐỊNH LÝ LỊCH ỨNG VIÊN SHOP OWNER
            </div>
            <h5 className="admin-modal-header-title">
              {ownerName} — {app.name}
            </h5>
          </div>
          <button className="admin-modal-close-btn" onClick={onClose} title="Đóng">✕</button>
        </div>

        <div className="admin-modal-body">
          <div className="admin-applicant-card">
            <div className="admin-applicant-card__header">
              <img src={avatarUrl} alt={ownerName} className="admin-applicant-avatar-lg" />
              <div className="admin-applicant-name-wrap">
                <h3 className="admin-applicant-name">{ownerName}</h3>
                <div className="admin-applicant-badges">
                  <span className="admin-applicant-badge role">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {ownerRole === 'SHOP_OWNER' ? 'Chủ Gian Hàng (SHOP_OWNER)' : 'Khách Hàng (CUSTOMER)'}
                  </span>

                  <span className="admin-applicant-badge status-active">
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                    {ownerStatus === 'ACTIVE' ? 'Tài khoản Đã Kích Hoạt' : ownerStatus}
                  </span>

                  <span className="admin-applicant-badge" style={{ background: '#F5F3EF', color: '#525252' }}>
                    Đơn: {currentStatus.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="admin-applicant-grid">
              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">HỌ VÀ TÊN ỨNG VIÊN</span>
                <span className="admin-applicant-field__val">{ownerName}</span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">ĐỊA CHỈ EMAIL</span>
                <span className="admin-applicant-field__val regular">{ownerEmail}</span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">SỐ ĐIỆN THOẠI LIÊN HỆ</span>
                <span className="admin-applicant-field__val regular">{ownerPhone}</span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">MÃ ĐỊNH DANH (USER ID)</span>
                <span
                  className="admin-applicant-field__val regular clickable-copy"
                  onClick={copyUserId}
                  title="Nhấn để sao chép User ID"
                >
                  <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{ownerIdString}</span>
                  <span style={{ fontSize: '11px', color: copiedId ? '#059669' : '#A6865A', fontWeight: 600 }}>
                    {copiedId ? '✓ Đã sao chép' : '📋 Copy'}
                  </span>
                </span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">TÊN GIAN HÀNG ĐĂNG KÝ</span>
                <span className="admin-applicant-field__val">{app.name}</span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">TRẠNG THÁI HỒ SƠ</span>
                <span className="admin-applicant-field__val" style={{ color: currentStatus.dot, fontWeight: 700 }}>
                  ● {currentStatus.label}
                </span>
              </div>

              <div className="admin-applicant-field" style={{ gridColumn: 'span 2' }}>
                <span className="admin-applicant-field__label">MÔ TẢ GIAN HÀNG / LĨNH VỰC KINH DOANH</span>
                <span className="admin-applicant-field__val regular" style={{ lineHeight: '1.5' }}>
                  {app.description || 'Chưa cung cấp mô tả chi tiết'}
                </span>
              </div>

              <div className="admin-applicant-field" style={{ gridColumn: 'span 2' }}>
                <span className="admin-applicant-field__label">ĐỊA CHỈ CỬA HÀNG / KHO HÀNG</span>
                <span className="admin-applicant-field__val regular">{fullAddress}</span>
                {hasGps && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#059669', fontFamily: 'monospace' }}>
                    📍 Tọa độ GPS: {Number(app.latitude).toFixed(5)}, {Number(app.longitude).toFixed(5)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="admin-applicant-docs-section">
            <div className="admin-doc-section-title">TÀI LIỆU PHÁP LÝ ĐÍNH KÈM THẨM ĐỊNH</div>
            <div className="admin-applicant-docs-grid">
              <div className="admin-applicant-doc-card">
                <div className="admin-applicant-doc-badge pdf">PDF</div>
                <div className="admin-applicant-doc-name">Giấy ĐKKD</div>
                <div className="admin-applicant-doc-status">
                  {app.businessLicenseUrl ? 'Đã tải lên' : 'Chưa có file'}
                </div>
                {app.businessLicenseUrl && (
                  <button
                    type="button"
                    className="admin-applicant-doc-btn"
                    onClick={() => onViewDoc({
                      label: 'Giấy Phép Đăng Ký Kinh Doanh (ĐKKD)',
                      filename: 'GPKD_Document.pdf',
                      url: app.businessLicenseUrl,
                      shopName: app.name,
                    })}
                  >
                    Xem tài liệu
                  </button>
                )}
              </div>

              <div className="admin-applicant-doc-card">
                <div className="admin-applicant-doc-badge id">CCCD</div>
                <div className="admin-applicant-doc-name">CCCD Mặt Trước</div>
                <div className="admin-applicant-doc-status">
                  {app.idCardFrontUrl ? 'Đã tải lên' : 'Chưa có file'}
                </div>
                {app.idCardFrontUrl && (
                  <button
                    type="button"
                    className="admin-applicant-doc-btn"
                    onClick={() => onViewDoc({
                      label: 'Căn Cước Công Dân (CCCD) — Mặt Trước',
                      filename: 'CCCD_Mat_Truoc.jpg',
                      url: app.idCardFrontUrl,
                      shopName: app.name,
                    })}
                  >
                    Xem tài liệu
                  </button>
                )}
              </div>

              {app.idCardBackUrl && (
                <div className="admin-applicant-doc-card">
                  <div className="admin-applicant-doc-badge id">CCCD</div>
                  <div className="admin-applicant-doc-name">CCCD Mặt Sau</div>
                  <div className="admin-applicant-doc-status">Đã tải lên</div>
                  <button
                    type="button"
                    className="admin-applicant-doc-btn"
                    onClick={() => onViewDoc({
                      label: 'Căn Cước Công Dân (CCCD) — Mặt Sau',
                      filename: 'CCCD_Mat_Sau.jpg',
                      url: app.idCardBackUrl,
                      shopName: app.name,
                    })}
                  >
                    Xem tài liệu
                  </button>
                </div>
              )}
            </div>
          </div>

          {app.status === 'REJECTED' && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '14px 18px', color: '#991B1B' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>LÝ DO TỪ CHỐI HỒ SƠ:</div>
              <div style={{ fontSize: '13px' }}>{app.rejectionReason || 'Không có lý do chi tiết'}</div>
            </div>
          )}

          {app.notes && (
            <div style={{ background: '#F5F3EF', border: '1px solid #E5E3DC', borderRadius: '12px', padding: '12px 18px', color: '#525252', fontSize: '12.5px' }}>
              <strong>Ghi chú nội bộ:</strong> {app.notes}
            </div>
          )}

          {app.status === 'PENDING' && (
            <div style={{ marginTop: '16px' }}>
              <label className="admin-modal-label">Ghi chú thẩm định phê duyệt (Tùy chọn)</label>
              <textarea
                className="admin-modal-textarea"
                rows={2}
                placeholder="Nhập ghi chú nội bộ thẩm định trước khi phê duyệt (nếu có)..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="admin-modal-footer">
          <button type="button" className="btn-modal-cancel" onClick={onClose} disabled={approving}>
            Đóng
          </button>

          {app.status === 'PENDING' && (
            <>
              <button
                type="button"
                className="btn-modal-danger"
                onClick={handleReject}
                disabled={approving}
              >
                Từ Chối Hồ Sơ
              </button>
              <button
                type="button"
                className="btn-modal-approve"
                onClick={handleApprove}
                disabled={approving}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {approving ? 'Đang phê duyệt...' : 'Phê Duyệt Gian Hàng'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ShopTableView({ shops, onSuspend, onReactivate, onApprove, onReject, onViewDetail }) {
  const statusMap = {
    ACTIVE: { label: 'Đang hoạt động', cls: 'active' },
    SUSPENDED: { label: 'Tạm ngưng', cls: 'suspended' },
    PENDING: { label: 'Chờ duyệt', cls: 'pending' },
    REJECTED: { label: 'Từ chối', cls: 'rejected' },
  };

  return (
    <div className="admin-shops-table-card">
      <div className="admin-shops-table-wrap">
        <table className="admin-shops-table">
          <thead>
            <tr>
              <th>Gian Hàng</th>
              <th>Chủ Sở Hữu</th>
              <th>Địa Chỉ & Khu Vực</th>
              <th>Trạng Thái Vận Hành</th>
              <th>Ngày Đăng Ký</th>
              <th style={{ textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => {
              const owner = s.ownerId || {};
              const ownerName = owner.FullName || owner.fullName || s.ownerName || 'Chưa cập nhật';
              const ownerPhone = s.phone || owner.Information?.[0]?.Phone || owner.phone || '—';
              const st = statusMap[s.status] || { label: s.status, cls: '' };

              return (
                <tr key={s._id}>
                  <td>
                    <div className="admin-table-shop-cell">
                      <img
                        src={s.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=141414&color=fff&size=80`}
                        alt={s.name}
                        className="admin-table-shop-avatar"
                      />
                      <div>
                        <div className="admin-table-shop-name">{s.name}</div>
                        <div className="admin-table-shop-cat">{s.description || 'Chưa có mô tả'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#171717' }}>{ownerName}</div>
                    <div style={{ fontSize: '11.5px', color: '#737373' }}>{ownerPhone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.city || 'Chưa cập nhật'}</div>
                    <div style={{ fontSize: '11.5px', color: '#737373', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.address}
                    </div>
                  </td>
                  <td>
                    <span className={`admin-table-badge ${st.cls}`}>
                      ● {st.label}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#737373' }}>
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="admin-table-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn-detail-action"
                        onClick={() => onViewDetail(s)}
                        title="Xem chi tiết hồ sơ vận hành"
                      >
                        Chi Tiết
                      </button>

                      {s.status === 'ACTIVE' && (
                        <button
                          type="button"
                          className="btn-suspend-action"
                          onClick={() => onSuspend(s)}
                          title="Tạm ngưng hoạt động gian hàng"
                        >
                          Tạm Ngưng
                        </button>
                      )}

                      {s.status === 'SUSPENDED' && (
                        <button
                          type="button"
                          className="btn-reactivate-action"
                          onClick={() => onReactivate(s)}
                          title="Kích hoạt lại hoạt động"
                        >
                          Kích Hoạt
                        </button>
                      )}

                      {s.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            className="btn-reject-action"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => onReject(s)}
                          >
                            Từ Chối
                          </button>
                          <button
                            type="button"
                            className="btn-approve-action"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => onApprove(s)}
                          >
                            Duyệt
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShopCard({ app, onApprove, onReject, onSuspend, onReactivate, onViewDoc, onViewApplicant, onViewDetail }) {
  const [approving, setApproving] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    await onApprove(app);
    setApproving(false);
  };

  const getFileName = (url, defaultName) => {
    if (!url) return defaultName;
    if (url.startsWith('data:')) return defaultName;
    const parts = url.split('/');
    const last = parts[parts.length - 1];
    return last && last.length < 30 ? last : defaultName;
  };

  const licenseFile = getFileName(app.businessLicenseUrl, 'GPKD_Document.pdf');
  const idCardFile = getFileName(app.idCardFrontUrl, 'CCCD_2Mat.jpg');
  const idCardBackFile = getFileName(app.idCardBackUrl, 'CCCD_Mat_Sau.jpg');

  const formatTime = (iso) => {
    if (!iso) return 'HÔM NAY';
    const d = new Date(iso);
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = d.toLocaleDateString('vi-VN');
    return `${timeStr} — ${dateStr}`;
  };

  const metaText = formatTime(app.createdAt);

  const statusMap = {
    ACTIVE: { label: 'Đang hoạt động', dot: '#059669', color: '#059669' },
    SUSPENDED: { label: 'Tạm ngưng vận hành', dot: '#D97706', color: '#D97706' },
    PENDING: { label: 'Đăng ký mới', dot: '#2563EB', color: '#2563EB' },
    REJECTED: { label: 'Từ chối', dot: '#DC2626', color: '#DC2626' },
  };

  const currentStatus = statusMap[app.status] || { label: app.status, dot: '#737373', color: '#737373' };
  const ownerName = app.ownerId?.FullName || app.ownerId?.fullName || app.ownerName || 'Chưa cập nhật';
  const ownerEmail = app.ownerId?.Email || app.ownerId?.email || app.ownerEmail || '—';
  const ownerPhone = app.phone || app.ownerId?.Information?.[0]?.Phone || app.ownerId?.phone || '—';
  const ownerRole = app.ownerId?.Role || app.ownerId?.role || 'CUSTOMER';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=141414&color=fff`;

  return (
    <div className="admin-shop-card">
      <div className="admin-shop-card__top">
        <div className="admin-shop-card__left">
          <div className="admin-shop-card__meta-tag">
            <span>{metaText}</span>
            <span>•</span>
            <span
              className="admin-shop-card__meta-dot"
              style={{ background: currentStatus.dot }}
            />
            <span
              className="admin-shop-card__meta-status"
              style={{ color: currentStatus.color, fontWeight: 700 }}
            >
              {currentStatus.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            {app.imageUrl && (
              <img
                src={app.imageUrl}
                alt={app.name}
                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E5E5E5', flexShrink: 0 }}
              />
            )}
            <h3 className="admin-shop-card__name" style={{ margin: 0 }}>{app.name}</h3>
          </div>
          <div className="admin-shop-card__category">
            <strong>Mô tả:</strong> {app.description || 'Chưa cập nhật mô tả'}
          </div>

          <div className="admin-owner-capsule">
            <div className="admin-owner-capsule__main">
              <img
                src={avatarUrl}
                alt={ownerName}
                className="admin-owner-avatar clickable"
                onClick={() => onViewApplicant(app)}
                title="Xem hồ sơ người đăng ký"
              />
              <div className="admin-owner-col">
                <span className="admin-owner-col__label">CHỦ SỞ HỮU</span>
                <span className="admin-owner-col__val">
                  {ownerName}
                  <span className={`admin-owner-role-tag ${ownerRole === 'SHOP_OWNER' ? 'owner' : ''}`}>
                    {ownerRole === 'SHOP_OWNER' ? 'Shop Owner' : 'Khách hàng'}
                  </span>
                </span>
              </div>
              <div className="admin-owner-col">
                <span className="admin-owner-col__label">EMAIL</span>
                <span className="admin-owner-col__val regular">{ownerEmail}</span>
              </div>
              <div className="admin-owner-col">
                <span className="admin-owner-col__label">ĐIỆN THOẠI</span>
                <span className="admin-owner-col__val regular">{ownerPhone}</span>
              </div>
              <div className="admin-owner-col">
                <span className="admin-owner-col__label">KHU VỰC</span>
                <span className="admin-owner-col__val regular">{app.city || 'Toàn quốc'}</span>
              </div>
              <div className="admin-owner-col">
                <span className="admin-owner-col__label">ĐỊA CHỈ CỬA HÀNG</span>
                <span className="admin-owner-col__val regular">
                  {app.address ? [app.address, app.ward, app.district, app.city].filter(Boolean).join(', ') : 'Chưa cập nhật'}
                  {app.latitude && app.longitude && (
                    <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                      📍 GPS: {Number(app.latitude).toFixed(4)}, {Number(app.longitude).toFixed(4)}
                    </div>
                  )}
                  {(app.address || (app.latitude && app.longitude)) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setShowMap(!showMap)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: '11px',
                          color: '#059669',
                          cursor: 'pointer',
                          fontWeight: 600,
                          textDecoration: 'underline',
                        }}
                      >
                        {showMap ? 'Ẩn bản đồ thu nhỏ ✕' : 'Xem bản đồ vệ tinh ↗'}
                      </button>
                    </div>
                  )}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="admin-owner-capsule__btn"
              onClick={() => onViewApplicant(app)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Xem Hồ Sơ Ứng Viên</span>
            </button>
          </div>

          {showMap && (
            <div style={{ marginTop: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #ECEAE5' }}>
              <iframe
                title={`Map of ${app.name}`}
                width="100%"
                height="220"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${app.latitude || encodeURIComponent(app.address || 'Hà Nội')},${app.longitude || ''}&hl=vi&z=15&output=embed`}
              />
            </div>
          )}
        </div>

        <div className="admin-shop-card__right">
          <div className="admin-doc-section-title">HỒ SƠ ĐÍNH KÈM THẨM ĐỊNH</div>

          <div className="admin-docs-grid">
            <div className="admin-doc-item">
              <div className="admin-doc-icon-badge pdf">
                PDF
              </div>
              <div className="admin-doc-info">
                <div className="admin-doc-name">Giấy ĐKKD</div>
                <div className="admin-doc-file" title={licenseFile}>
                  {licenseFile}
                </div>
                <div className="admin-doc-status">
                  {app.businessLicenseUrl ? 'Đã tải lên ✓' : 'Chưa có file'}
                </div>
              </div>
              {app.businessLicenseUrl && (
                <button
                  type="button"
                  className="admin-doc-view-btn"
                  title="Xem tài liệu"
                  onClick={() => onViewDoc({
                    label: 'Giấy Phép Đăng Ký Kinh Doanh (ĐKKD)',
                    filename: licenseFile,
                    url: app.businessLicenseUrl,
                    shopName: app.name,
                  })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
            </div>

            <div className="admin-doc-item">
              <div className="admin-doc-icon-badge id">
                CCCD
              </div>
              <div className="admin-doc-info">
                <div className="admin-doc-name">{app.idCardBackUrl ? 'CCCD Mặt Trước' : 'CCCD 2 mặt'}</div>
                <div className="admin-doc-file" title={idCardFile}>
                  {idCardFile}
                </div>
                <div className="admin-doc-status">
                  {app.idCardFrontUrl ? 'Đã tải lên ✓' : 'Chưa có file'}
                </div>
              </div>
              {app.idCardFrontUrl && (
                <button
                  type="button"
                  className="admin-doc-view-btn"
                  title="Xem CCCD"
                  onClick={() => onViewDoc({
                    label: app.idCardBackUrl ? 'Căn Cước Công Dân (CCCD) — Mặt Trước' : 'Căn Cước Công Dân (CCCD) 2 Mặt',
                    filename: idCardFile,
                    url: app.idCardFrontUrl,
                    shopName: app.name,
                  })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
            </div>

            {app.idCardBackUrl && (
              <div className="admin-doc-item">
                <div className="admin-doc-icon-badge id">
                  CCCD
                </div>
                <div className="admin-doc-info">
                  <div className="admin-doc-name">CCCD Mặt Sau</div>
                  <div className="admin-doc-file" title={idCardBackFile}>
                    {idCardBackFile}
                  </div>
                  <div className="admin-doc-status">
                    Đã tải lên ✓
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-doc-view-btn"
                  title="Xem CCCD Mặt Sau"
                  onClick={() => onViewDoc({
                    label: 'Căn Cước Công Dân (CCCD) — Mặt Sau',
                    filename: idCardBackFile,
                    url: app.idCardBackUrl,
                    shopName: app.name,
                  })}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="admin-shop-card__bottom">
        <div className="admin-shop-card__note">
          <span className="admin-shop-card__note-icon">i</span>
          <span>
            {app.status === 'SUSPENDED' && app.rejectionReason
              ? `Lý do tạm ngưng: ${app.rejectionReason}`
              : app.notes || (app.address ? `Địa chỉ đăng ký: ${app.address}` : 'Hồ sơ pháp lý đầy đủ.')}
          </span>
        </div>

        <div className="admin-shop-card__actions">
          <button
            type="button"
            className="btn-detail-action"
            onClick={() => onViewDetail(app)}
          >
            Chi Tiết Vận Hành
          </button>

          {app.status === 'ACTIVE' && (
            <button
              type="button"
              className="btn-suspend-action"
              onClick={() => onSuspend(app)}
            >
              Tạm Ngưng
            </button>
          )}

          {app.status === 'SUSPENDED' && (
            <button
              type="button"
              className="btn-reactivate-action"
              onClick={() => onReactivate(app)}
            >
              Kích Hoạt Lại
            </button>
          )}

          {app.status === 'PENDING' && (
            <>
              <button
                type="button"
                className="btn-reject-action"
                onClick={() => onReject(app)}
              >
                Từ Chối
              </button>
              <button
                type="button"
                className="btn-approve-action"
                onClick={handleApprove}
                disabled={approving}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {approving ? 'Đang duyệt...' : 'Phê Duyệt'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OwnerShopsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam && ['ALL', 'ACTIVE', 'SUSPENDED'].includes(tabParam)
      ? tabParam
      : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('cards');

  const [rejectTarget, setRejectTarget] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [detailShop, setDetailShop] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [viewingApplicant, setViewingApplicant] = useState(null);
  const [toast, setToast] = useState(null);

  const [shops, setShops] = useState([]);
  const [counts, setCounts] = useState({ ALL: 0, PENDING: 0, ACTIVE: 0, SUSPENDED: 0, REJECTED: 0 });
  const [newToday, setNewToday] = useState(0);
  const [approvalRate, setApprovalRate] = useState('0.0');
  const [avgProcessingHours, setAvgProcessingHours] = useState('0.0');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 6;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['ALL', 'ACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED'].includes(t)) {
      setActiveTab(t);
      setPage(1);
    }
  }, [searchParams]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setPage(1);
    setSearchParams({ tab: tabKey });
  };

  const fetchCounts = useCallback(async () => {
    try {
      const result = await getAdminShopsStatsApi();
      if (result.success) {
        setCounts(result.counts || { ALL: 0, PENDING: 0, ACTIVE: 0, SUSPENDED: 0, REJECTED: 0 });
        setNewToday(result.newToday || 0);
        setApprovalRate(result.approvalRate || '0.0');
        setAvgProcessingHours(result.avgProcessingHours || '0.0');
      }
    } catch (_) {}
  }, []);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: LIMIT,
      };
      if (activeTab !== 'ALL') {
        params.status = activeTab;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (cityFilter !== 'ALL') {
        params.city = cityFilter;
      }

      const data = await getAdminShopsListApi(params);

      if (data.success) {
        if ((!data.data || data.data.length === 0) && data.total > 0 && page > 1) {
          setPage((p) => Math.max(1, p - 1));
          return;
        }
        setShops(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setShops([]);
        setTotal(0);
      }
    } catch (err) {
      showToast('Không thể kết nối đến máy chủ: ' + err.message, 'error');
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, cityFilter, page]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, cityFilter]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const handleApprove = async () => {};
  const handleRejectConfirm = async () => { setRejectTarget(null); };

  const handleSuspendConfirm = async (shopId, reason, notes) => {
    try {
      const adminId = getAdminId();
      const data = await toggleSuspendShopApi(shopId, {
        adminId,
        reason,
        notes,
      });
      if (!data.success) throw new Error(data.message);

      setSuspendTarget(null);
      showToast(data.message || 'Đã tạm ngưng gian hàng thành công.', 'warning');
      await fetchShops();
      await fetchCounts();
    } catch (err) {
      showToast('Lỗi khi tạm ngưng gian hàng: ' + err.message, 'error');
    }
  };

  const handleReactivateConfirm = async (shopId, notes) => {
    try {
      const adminId = getAdminId();
      const data = await toggleSuspendShopApi(shopId, {
        adminId,
        notes,
      });
      if (!data.success) throw new Error(data.message);

      setReactivateTarget(null);
      showToast(data.message || 'Đã kích hoạt lại gian hàng thành công!', 'success');
      await fetchShops();
      await fetchCounts();
    } catch (err) {
      showToast('Lỗi khi kích hoạt lại: ' + err.message, 'error');
    }
  };

  const handleExportCSV = () => {
    if (!shops || shops.length === 0) {
      showToast('Không có dữ liệu gian hàng để xuất báo cáo.', 'error');
      return;
    }

    const headers = [
      'Mã Gian Hàng',
      'Tên Gian Hàng',
      'Chủ Sở Hữu',
      'Email',
      'Số Điện Thoại',
      'Tỉnh / Thành Phố',
      'Quận / Huyện',
      'Địa Chỉ Chi Tiết',
      'Vĩ Độ (Latitude)',
      'Kinh Độ (Longitude)',
      'Trạng Thái Vận Hành',
      'Ngày Nộp Hồ Sơ',
      'Ngày Xét Duyệt',
    ];

    const rows = shops.map((s) => {
      const owner = s.ownerId || {};
      const ownerName = owner.FullName || owner.fullName || s.ownerName || '';
      const ownerEmail = owner.Email || owner.email || s.ownerEmail || '';
      const ownerPhone = s.phone || owner.Information?.[0]?.Phone || owner.phone || '';
      const statusLabel =
        s.status === 'ACTIVE'
          ? 'Đang hoạt động'
          : s.status === 'SUSPENDED'
          ? 'Tạm ngưng'
          : s.status === 'PENDING'
          ? 'Chờ duyệt'
          : s.status === 'REJECTED'
          ? 'Từ chối'
          : s.status;

      return [
        s._id || '',
        s.name || '',
        ownerName,
        ownerEmail,
        ownerPhone,
        s.city || '',
        s.district || '',
        s.address || '',
        s.latitude != null ? String(s.latitude) : '',
        s.longitude != null ? String(s.longitude) : '',
        statusLabel,
        s.createdAt ? new Date(s.createdAt).toLocaleString('vi-VN') : '',
        s.reviewedAt ? new Date(s.reviewedAt).toLocaleString('vi-VN') : '',
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`);
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `VESTORA_QuanLyGianHang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất báo cáo ${shops.length} gian hàng thành công!`);
  };

  return (
    <div className="admin-shops-layout">
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="admin-shops-viewport">
        <OwnerTopHeader
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Quản Lý Gian Hàng & Chi Nhánh"
        />

        <main className="admin-shops-content">
          <div className="admin-shops-header-row">
            <div className="admin-shops-breadcrumb">
              <span className="current">
                {activeTab === 'PENDING' ? 'Hồ Sơ Chờ Phê Duyệt' : activeTab === 'REJECTED' ? 'Hồ Sơ Đã Từ Chối' : 'Hồ Sơ Đã Duyệt'}
              </span>
            </div>

            <div className="admin-shops-live-pill">
              GIÁM SÁT HOẠT ĐỘNG GIAN HÀNG
            </div>
          </div>

          <div className="admin-shops-title-block">
            <h1 className="admin-shops-page-title">
              Quản Lý & Phê Duyệt Gian Hàng
            </h1>
            <p className="admin-shops-page-sub">
              Theo dõi mạng lưới gian hàng, thẩm định hồ sơ đối tác mở shop và điều phối trạng thái hoạt động trên toàn hệ thống VESTORA.
            </p>
          </div>

          {/* 3 Metrics Cards for Application Approvals */}
          <div className="admin-shops-metrics-grid">
            <div className="admin-metric-card">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">HỒ SƠ CHỜ PHÊ DUYỆT</span>
                <div className="admin-metric-card__icon-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="admin-metric-card__main-row">
                  <span className="admin-metric-card__number" style={{ color: '#2563EB' }}>{counts.PENDING || 0}</span>
                  {newToday > 0 && (
                    <span className="admin-metric-card__badge-green">+{newToday} nộp hôm nay</span>
                  )}
                </div>
                <p className="admin-metric-card__subtext">Yêu cầu hoàn tất thẩm định trong 24 giờ</p>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">THỜI GIAN XỬ LÝ TRUNG BÌNH</span>
                <div className="admin-metric-card__icon-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="admin-metric-card__main-row">
                  <span className="admin-metric-card__number">{avgProcessingHours} <span className="unit">giờ</span></span>
                </div>
                <p className="admin-metric-card__subtext">Thời gian phản hồi kết quả cho ứng viên</p>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">TỶ LỆ PHÊ DUYỆT HỒ SƠ</span>
                <div className="admin-metric-card__icon-box" style={{ color: '#059669' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="admin-metric-card__main-row">
                  <span className="admin-metric-card__number" style={{ color: '#059669' }}>{approvalRate}%</span>
                </div>
                <p className="admin-metric-card__subtext">Hồ sơ đạt tiêu chuẩn pháp lý hợp quy</p>
              </div>
            </div>
          </div>

          {/* Operational Toolbar */}
          <div className="admin-shops-toolbar">
            <div className="admin-shops-tabs-pill">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`admin-shops-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab.key)}
                >
                  <span>{tab.label}</span>
                  <span className="admin-shops-tab-count">
                    {counts[tab.key] || 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="admin-shops-search-wrap">
              <div className="admin-shops-search-box">
                <span className="admin-shops-search-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="admin-shops-search-input"
                  placeholder="Tìm kiếm tên shop, chủ sở hữu, SĐT, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="admin-shops-select-filter"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                title="Lọc theo Tỉnh / Thành phố"
              >
                {CITIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>

              <button
                type="button"
                className="admin-shops-export-btn"
                onClick={handleExportCSV}
                title="Xuất danh sách gian hàng dạng file CSV"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Xuất Báo Cáo
              </button>

              <div className="admin-shops-view-switch">
                <button
                  type="button"
                  className={`admin-shops-view-switch-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Chế độ xem dạng thẻ"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  Thẻ
                </button>
                <button
                  type="button"
                  className={`admin-shops-view-switch-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Chế độ xem dạng bảng"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  Bảng
                </button>
              </div>

              <button
                type="button"
                className="admin-shops-filter-btn"
                title="Làm mới danh sách"
                onClick={() => {
                  fetchCounts();
                  fetchShops();
                  showToast('Đã làm mới dữ liệu gian hàng');
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>
          </div>

          {/* Main List / Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#737373' }}>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>Đang tải danh sách gian hàng...</div>
            </div>
          ) : shops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #ECEAE5' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: '0 0 4px' }}>
                Không tìm thấy gian hàng phù hợp
              </h4>
              <p style={{ fontSize: '13px', color: '#737373', margin: 0 }}>
                Không có dữ liệu gian hàng phù hợp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <ShopTableView
              shops={shops}
              onSuspend={setSuspendTarget}
              onReactivate={setReactivateTarget}
              onApprove={handleApprove}
              onReject={setRejectTarget}
              onViewDetail={setDetailShop}
            />
          ) : (
            <div className="admin-shops-list">
              {shops.map((app) => (
                <ShopCard
                  key={app._id}
                  app={app}
                  onApprove={handleApprove}
                  onReject={setRejectTarget}
                  onSuspend={setSuspendTarget}
                  onReactivate={setReactivateTarget}
                  onViewDoc={setPreviewDoc}
                  onViewApplicant={setViewingApplicant}
                  onViewDetail={setDetailShop}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="admin-shops-pagination">
              <div className="admin-shops-pagination__info">
                Hiển thị {shops.length > 0 ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} trong số {total} gian hàng
              </div>

              <div className="admin-shops-pagination__pages">
                <button
                  className="admin-shops-page-item"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`admin-shops-page-item ${page === p ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="admin-shops-page-item"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Operational Modals */}
      {detailShop && (
        <ShopDetailModal
          app={detailShop}
          onClose={() => setDetailShop(null)}
          onSuspend={setSuspendTarget}
          onReactivate={setReactivateTarget}
          onApprove={handleApprove}
          onReject={setRejectTarget}
          onViewDoc={setPreviewDoc}
        />
      )}

      {suspendTarget && (
        <SuspendModal
          app={suspendTarget}
          onClose={() => setSuspendTarget(null)}
          onConfirm={handleSuspendConfirm}
        />
      )}

      {reactivateTarget && (
        <ReactivateModal
          app={reactivateTarget}
          onClose={() => setReactivateTarget(null)}
          onConfirm={handleReactivateConfirm}
        />
      )}

      {viewingApplicant && (
        <ApplicantDetailModal
          app={viewingApplicant}
          onClose={() => setViewingApplicant(null)}
          onApprove={handleApprove}
          onReject={setRejectTarget}
          onViewDoc={setPreviewDoc}
        />
      )}

      {rejectTarget && (
        <RejectModal
          app={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
        />
      )}

      {previewDoc && (
        <DocPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {toast && (
        <div className={`admin-toast-banner ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : toast.type === 'warning' ? '⚠' : '✕'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
