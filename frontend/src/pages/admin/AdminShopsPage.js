import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import apiClient from '../../services/api';
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
  { key: 'PENDING',  label: 'Chờ Duyệt' },
  { key: 'ACTIVE',   label: 'Đã Duyệt' },
  { key: 'REJECTED', label: 'Từ Chối' },
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

function ApplicantDetailModal({ app, onClose, onApprove, onReject, onViewDoc }) {
  const [copiedId, setCopiedId] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  if (!app) return null;

  const owner = app.ownerId || {};
  const ownerName = owner.FullName || owner.fullName || 'Chưa cập nhật';
  const ownerEmail = owner.Email || owner.email || '—';
  const ownerPhone = app.phone || '—';
  const ownerIdString = owner._id || owner.UserId || owner.userId || '—';
  const ownerRole = owner.Role || owner.role || 'CUSTOMER';
  const ownerStatus = owner.Status || owner.status || 'ACTIVE';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=141414&color=fff&size=128`;

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = d.toLocaleDateString('vi-VN');
    return `${timeStr} — ${dateStr}`;
  };

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
                <span className="admin-applicant-field__label">EMAIL XÁC THỰC</span>
                <span className="admin-applicant-field__val" title={ownerEmail}>{ownerEmail}</span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">SỐ ĐIỆN THOẠI ĐĂNG KÝ</span>
                <span className="admin-applicant-field__val">{ownerPhone}</span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">MÃ ĐỊNH DANH TÀI KHOẢN (UID)</span>
                <span className="admin-applicant-field__val" style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                  <span>{ownerIdString && ownerIdString !== '—' ? `${String(ownerIdString).slice(0, 10)}...` : '—'}</span>
                  {ownerIdString && ownerIdString !== '—' && (
                    <button
                      type="button"
                      className="admin-copy-uid-btn"
                      onClick={copyUserId}
                      title="Sao chép toàn bộ ID người dùng"
                    >
                      {copiedId ? 'Đã chép ✓' : 'Sao chép'}
                    </button>
                  )}
                </span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">NGÀY THAM GIA NỀN TẢNG</span>
                <span className="admin-applicant-field__val">{formatTime(owner.createdAt)}</span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">THỜI ĐIỂM NỘP HỒ SƠ</span>
                <span className="admin-applicant-field__val">{formatTime(app.createdAt)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="admin-applicant-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              THÔNG TIN GIAN HÀNG ĐĂNG KÝ
            </div>

            <div className="admin-applicant-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">TÊN GIAN HÀNG</span>
                <span className="admin-applicant-field__val" style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {app.imageUrl && (
                    <img
                      src={app.imageUrl}
                      alt={app.name}
                      style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #D4D4D4' }}
                    />
                  )}
                  <span>{app.name}</span>
                </span>
              </div>

              <div className="admin-applicant-field">
                <span className="admin-applicant-field__label">NGÀNH HÀNG / MÔ TẢ</span>
                <span className="admin-applicant-field__val" style={{ fontWeight: 400 }}>
                  {app.description || 'Chưa cập nhật'}
                </span>
              </div>

              <div className="admin-applicant-field" style={{ gridColumn: 'span 2' }}>
                <span className="admin-applicant-field__label">ĐỊA CHỈ SHOWROOM / KHO HÀNG</span>
                <span className="admin-applicant-field__val" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ fontWeight: 600 }}>{fullAddress}</span>
                  {hasGps && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#059669', background: '#ECFDF5', padding: '3px 8px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                      <span>Định vị GPS chính xác: <strong>{Number(app.latitude).toFixed(5)}°B, {Number(app.longitude).toFixed(5)}°Đ</strong></span>
                    </div>
                  )}
                  {(app.address || hasGps) && (
                    <a
                      href={hasGps ? `https://www.google.com/maps?q=${app.latitude},${app.longitude}&z=17` : `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: '#8C6D3F',
                        textDecoration: 'none',
                        fontWeight: 600,
                        marginTop: '2px',
                      }}
                    >
                      <span>📍 Xem vị trí showroom trên Google Maps (Ghim đỏ chính xác) ↗</span>
                    </a>
                  )}
                  {(hasGps || app.address) && (
                    <div style={{ width: '100%', height: '220px', marginTop: '6px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E5E5E5', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                      <iframe
                        title="Bản đồ vị trí showroom"
                        src={hasGps
                          ? `https://maps.google.com/maps?q=${app.latitude},${app.longitude}&hl=vi&z=17&output=embed`
                          : `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&hl=vi&z=14&output=embed`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        loading="lazy"
                      />
                    </div>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="admin-applicant-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <circle cx="8" cy="10" r="2" />
                <line x1="14" y1="10" x2="18" y2="10" />
                <line x1="14" y1="14" x2="18" y2="14" />
              </svg>
              HỒ SƠ ĐỊNH DANH NHÂN THÂN & PHÁP LÝ (KYC)
            </div>

            <div className="admin-applicant-docs-grid">
              <div className="admin-applicant-doc-card">
                <div
                  className="admin-applicant-doc-thumb"
                  onClick={() => app.idCardFrontUrl && onViewDoc({
                    label: 'Căn Cước Công Dân (CCCD) — Mặt Trước',
                    filename: 'CCCD_Mat_Truoc.jpg',
                    url: app.idCardFrontUrl,
                    shopName: app.name,
                  })}
                >
                  {app.idCardFrontUrl ? (
                    <>
                      <img src={app.idCardFrontUrl} alt="CCCD Mặt Trước" />
                      <div className="admin-applicant-doc-thumb-zoom-hint">🔍 Nhấn để phóng to</div>
                    </>
                  ) : (
                    <div style={{ color: '#737373', fontSize: '11px', textAlign: 'center', padding: '10px' }}>
                      Chưa có ảnh mặt trước
                    </div>
                  )}
                </div>
                <div className="admin-applicant-doc-body">
                  <div className="admin-applicant-doc-title">CCCD Mặt Trước</div>
                  <div className="admin-applicant-doc-status">
                    {app.idCardFrontUrl ? 'Đã tải lên ✓' : 'Chưa cung cấp'}
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
                      Xem chi tiết
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-applicant-doc-card">
                <div
                  className="admin-applicant-doc-thumb"
                  onClick={() => (app.idCardBackUrl || app.idCardFrontUrl) && onViewDoc({
                    label: app.idCardBackUrl ? 'Căn Cước Công Dân (CCCD) — Mặt Sau' : 'Căn Cước Công Dân (CCCD) 2 Mặt',
                    filename: 'CCCD_Mat_Sau.jpg',
                    url: app.idCardBackUrl || app.idCardFrontUrl,
                    shopName: app.name,
                  })}
                >
                  {app.idCardBackUrl ? (
                    <>
                      <img src={app.idCardBackUrl} alt="CCCD Mặt Sau" />
                      <div className="admin-applicant-doc-thumb-zoom-hint">🔍 Nhấn để phóng to</div>
                    </>
                  ) : app.idCardFrontUrl ? (
                    <div style={{ color: '#525252', fontSize: '11px', textAlign: 'center', padding: '10px' }}>
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>🪪</div>
                      Đã đính kèm chung trong tệp CCCD
                    </div>
                  ) : (
                    <div style={{ color: '#737373', fontSize: '11px', textAlign: 'center', padding: '10px' }}>
                      Chưa có ảnh mặt sau
                    </div>
                  )}
                </div>
                <div className="admin-applicant-doc-body">
                  <div className="admin-applicant-doc-title">CCCD Mặt Sau</div>
                  <div className="admin-applicant-doc-status">
                    {app.idCardBackUrl ? 'Đã tải lên ✓' : app.idCardFrontUrl ? 'Đính kèm chung ✓' : 'Chưa cung cấp'}
                  </div>
                  {(app.idCardBackUrl || app.idCardFrontUrl) && (
                    <button
                      type="button"
                      className="admin-applicant-doc-btn"
                      onClick={() => onViewDoc({
                        label: app.idCardBackUrl ? 'Căn Cước Công Dân (CCCD) — Mặt Sau' : 'Căn Cước Công Dân (CCCD) 2 Mặt',
                        filename: 'CCCD_Mat_Sau.jpg',
                        url: app.idCardBackUrl || app.idCardFrontUrl,
                        shopName: app.name,
                      })}
                    >
                      Xem chi tiết
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-applicant-doc-card">
                <div
                  className="admin-applicant-doc-thumb"
                  onClick={() => app.businessLicenseUrl && onViewDoc({
                    label: 'Giấy Phép Đăng Ký Kinh Doanh (ĐKKD)',
                    filename: 'GPKD_Document.pdf',
                    url: app.businessLicenseUrl,
                    shopName: app.name,
                  })}
                >
                  {app.businessLicenseUrl ? (
                    app.businessLicenseUrl.startsWith('data:application/pdf') ? (
                      <div style={{ color: '#DC2626', fontSize: '11px', textAlign: 'center', padding: '10px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '4px' }}>📄</div>
                        Tài liệu PDF ĐKKD
                      </div>
                    ) : (
                      <>
                        <img src={app.businessLicenseUrl} alt="Giấy ĐKKD" />
                        <div className="admin-applicant-doc-thumb-zoom-hint">🔍 Nhấn để phóng to</div>
                      </>
                    )
                  ) : (
                    <div style={{ color: '#737373', fontSize: '11px', textAlign: 'center', padding: '10px' }}>
                      Chưa tải lên Giấy ĐKKD
                    </div>
                  )}
                </div>
                <div className="admin-applicant-doc-body">
                  <div className="admin-applicant-doc-title">Giấy Phép ĐKKD</div>
                  <div className="admin-applicant-doc-status">
                    {app.businessLicenseUrl ? 'Đã tải lên ✓' : 'Chưa cung cấp'}
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
              </div>
              {app.imageUrl && (
                <div className="admin-applicant-doc-card">
                  <div
                    className="admin-applicant-doc-thumb"
                    onClick={() => onViewDoc({
                      label: 'Ảnh Đại Diện / Logo Gian Hàng',
                      filename: 'Logo_Showroom.png',
                      url: app.imageUrl,
                      shopName: app.name,
                    })}
                  >
                    <img src={app.imageUrl} alt="Logo Showroom" />
                    <div className="admin-applicant-doc-thumb-zoom-hint">🔍 Nhấn để phóng to</div>
                  </div>
                  <div className="admin-applicant-doc-body">
                    <div className="admin-applicant-doc-title">Logo / Showroom</div>
                    <div className="admin-applicant-doc-status">Đã tải lên ✓</div>
                    <button
                      type="button"
                      className="admin-applicant-doc-btn"
                      onClick={() => onViewDoc({
                        label: 'Ảnh Đại Diện / Logo Gian Hàng',
                        filename: 'Logo_Showroom.png',
                        url: app.imageUrl,
                        shopName: app.name,
                      })}
                    >
                      Xem chi tiết
                    </button>
                  </div>
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

function ShopCard({ app, onApprove, onReject, onViewDoc, onViewApplicant }) {
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
    PENDING: { label: 'Đăng ký mới', dot: '#059669' },
    ACTIVE: { label: 'Đã duyệt', dot: '#2563EB' },
    REJECTED: { label: 'Từ chối', dot: '#DC2626' },
    SUSPENDED: { label: 'Tạm ngưng', dot: '#D97706' },
  };

  const currentStatus = statusMap[app.status] || { label: app.status, dot: '#737373' };

  const ownerName = app.ownerId?.FullName || app.ownerId?.fullName || 'Chưa cập nhật';
  const ownerEmail = app.ownerId?.Email || app.ownerId?.email || '—';
  const ownerPhone = app.phone || '—';
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
              style={{ color: currentStatus.dot }}
            >
              {currentStatus.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            {app.imageUrl && (
              <img
                src={app.imageUrl}
                alt={app.name}
                style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E5E5E5', flexShrink: 0 }}
              />
            )}
            <h3 className="admin-shop-card__name" style={{ margin: 0 }}>{app.name}</h3>
          </div>
          <div className="admin-shop-card__category">
            <strong>Ngành hàng / Mô tả:</strong> {app.description || 'Chưa cập nhật'}
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
                <span className="admin-owner-col__label">MÃ TÀI KHOẢN (UID)</span>
                <span className="admin-owner-col__val regular" style={{ fontFamily: 'monospace', fontSize: '11px' }} title={app.ownerId?._id || '—'}>
                  {app.ownerId?._id ? `#${String(app.ownerId._id).slice(-8)}` : '—'}
                </span>
              </div>
              <div className="admin-owner-col">
                <span className="admin-owner-col__label">ĐỊA CHỈ SHOWROOM</span>
                <span className="admin-owner-col__val regular">
                  {app.address ? [app.address, app.ward, app.district, app.city].filter(Boolean).join(', ') : 'Chưa cập nhật'}
                  {app.latitude && app.longitude && (
                    <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                      📍 GPS: {Number(app.latitude).toFixed(4)}, {Number(app.longitude).toFixed(4)} (Chính xác)
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
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        {showMap ? 'Thu nhỏ bản đồ ▲' : '🗺️ Xem bản đồ showroom ▼'}
                      </button>
                      <a
                        href={(app.latitude && app.longitude) ? `https://www.google.com/maps?q=${app.latitude},${app.longitude}&z=17` : `https://www.google.com/maps?q=${encodeURIComponent([app.address, app.ward, app.city].filter(Boolean).join(', '))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11px',
                          color: '#8C6D3F',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        <span>Mở Google Maps ↗</span>
                      </a>
                    </div>
                  )}
                  {showMap && (
                    <div style={{ width: '100%', height: '170px', marginTop: '6px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #E5E5E5' }}>
                      <iframe
                        title={`Bản đồ ${app.name}`}
                        src={(app.latitude && app.longitude)
                          ? `https://maps.google.com/maps?q=${app.latitude},${app.longitude}&hl=vi&z=17&output=embed`
                          : `https://maps.google.com/maps?q=${encodeURIComponent([app.address, app.ward, app.city].filter(Boolean).join(', '))}&hl=vi&z=14&output=embed`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        loading="lazy"
                      />
                    </div>
                  )}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-view-applicant-profile"
              onClick={() => onViewApplicant(app)}
              title="Xem thông tin chi tiết của người đăng ký trở thành shop owner"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Xem Hồ Sơ Người Đăng Ký</span>
            </button>
          </div>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <circle cx="8" cy="10" r="2" />
                  <line x1="14" y1="10" x2="18" y2="10" />
                  <line x1="14" y1="14" x2="18" y2="14" />
                </svg>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <circle cx="8" cy="10" r="2" />
                    <line x1="14" y1="10" x2="18" y2="10" />
                    <line x1="14" y1="14" x2="18" y2="14" />
                  </svg>
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

            {app.imageUrl && (
              <div className="admin-doc-item">
                <div className="admin-doc-icon-badge" style={{ background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0', fontWeight: 700, fontSize: '11px' }}>
                  IMG
                </div>
                <div className="admin-doc-info">
                  <div className="admin-doc-name">Logo Showroom</div>
                  <div className="admin-doc-file" title="Logo_Showroom.png">
                    Logo_Showroom.png
                  </div>
                  <div className="admin-doc-status">
                    Đã tải lên ✓
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-doc-view-btn"
                  title="Xem Logo Showroom"
                  onClick={() => onViewDoc({
                    label: 'Ảnh Đại Diện / Logo Gian Hàng',
                    filename: 'Logo_Showroom.png',
                    url: app.imageUrl,
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
            {app.notes || (app.address ? `Địa chỉ đăng ký: ${app.address}` : 'Cần đối chiếu số hiệu ĐKKD trên cổng thông tin quốc gia trước khi nhấn duyệt.')}
          </span>
        </div>

        {app.status === 'PENDING' ? (
          <div className="admin-shop-card__actions">
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
          </div>
        ) : (
          <div style={{ fontSize: '13px', fontWeight: 600, color: app.status === 'ACTIVE' ? '#059669' : '#DC2626' }}>
            {app.status === 'ACTIVE' ? '✓ Đã phê duyệt thành công' : `✕ Đã từ chối: ${app.rejectionReason || 'Hồ sơ không hợp lệ'}`}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminShopsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam && ['PENDING', 'ACTIVE', 'REJECTED'].includes(tabParam) ? tabParam : 'PENDING'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [viewingApplicant, setViewingApplicant] = useState(null);
  const [toast, setToast] = useState(null);

  const [shops, setShops] = useState([]);
  const [counts, setCounts] = useState({ PENDING: 0, ACTIVE: 0, REJECTED: 0 });
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
    if (t && ['PENDING', 'ACTIVE', 'REJECTED'].includes(t)) {
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
      const result = await apiClient.get('/api/admin/shops/stats');
      if (result.success) {
        setCounts(result.counts || { PENDING: 0, ACTIVE: 0, REJECTED: 0 });
        setNewToday(result.newToday || 0);
        setApprovalRate(result.approvalRate || '0.0');
        setAvgProcessingHours(result.avgProcessingHours || '0.0');
      }
    } catch (_) {
    }
  }, []);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/api/admin/shops', {
        params: {
          status: activeTab,
          search: searchQuery,
          page,
          limit: LIMIT,
        },
      });

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
  }, [activeTab, searchQuery, page]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const handleApprove = async (shop, customNotes = '') => {
    try {
      const adminId = getAdminId();
      const data = await apiClient.put(`/api/admin/shops/${shop._id}/approve`, {
        adminId,
        notes: customNotes.trim() || 'Đã thẩm định thông tin ĐKKD và CCCD hợp lệ.',
      });
      if (!data.success) throw new Error(data.message);

      showToast(`Đã phê duyệt gian hàng "${shop.name}" thành công!`);
      await fetchShops();
      await fetchCounts();
    } catch (err) {
      showToast('Lỗi phê duyệt: ' + err.message, 'error');
    }
  };

  const handleRejectConfirm = async (shopId, rejectionReason, notes) => {
    try {
      const adminId = getAdminId();
      const data = await apiClient.put(`/api/admin/shops/${shopId}/reject`, {
        adminId,
        rejectionReason,
        notes,
      });
      if (!data.success) throw new Error(data.message);

      setRejectTarget(null);
      showToast('Đã từ chối hồ sơ gian hàng.');
      await fetchShops();
      await fetchCounts();
    } catch (err) {
      showToast('Lỗi từ chối: ' + err.message, 'error');
    }
  };

  return (
    <div className="admin-shops-layout">
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
      />

      <div className="admin-shops-viewport">
        <AdminTopHeader
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          breadcrumb={activeTab === 'ACTIVE' ? 'Quản Lý Gian Hàng' : activeTab === 'REJECTED' ? 'Hồ Sơ Từ Chối' : 'Phê Duyệt Shop'}
        />

        <main className="admin-shops-content">
          <div className="admin-shops-header-row">
            <div className="admin-shops-breadcrumb">
              <span className="current">
                {activeTab === 'ACTIVE' ? 'Quản Lý Gian Hàng' : activeTab === 'REJECTED' ? 'Hồ Sơ Từ Chối' : 'Phê Duyệt Shop'}
              </span>
            </div>

            <div className="admin-shops-live-pill">
              HỒ SƠ CẬP NHẬT TRỰC TUYẾN
            </div>
          </div>

          <div className="admin-shops-title-block">
            <h1 className="admin-shops-page-title">Phê Duyệt Gian Hàng Mới</h1>
            <p className="admin-shops-page-sub">
              Xem xét hồ sơ đăng ký mở shop, kiểm tra giấy phép kinh doanh và CCCD của người đăng ký.
            </p>
          </div>

          <div className="admin-shops-metrics-grid">
            <div className="admin-metric-card">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">CHỜ PHÊ DUYỆT</span>
                <div className="admin-metric-card__icon-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="admin-metric-card__main-row">
                  <span className="admin-metric-card__number">{counts.PENDING}</span>
                  <span className="admin-metric-card__badge-green">
                    ↗ +{newToday} mới nộp hôm nay
                  </span>
                </div>
                <p className="admin-metric-card__subtext">
                  Yêu cầu hoàn thiện thẩm định trong 24 giờ
                </p>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">THỜI GIAN XỬ LÝ TB</span>
                <div className="admin-metric-card__icon-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="admin-metric-card__main-row">
                  <span className="admin-metric-card__number">
                    {avgProcessingHours} <span className="unit">giờ</span>
                  </span>
                </div>
                <div className="admin-metric-card__bar-row">
                  <div className="admin-metric-card__bar-track">
                    <div
                      className="admin-metric-card__bar-fill"
                      style={{
                        width: `${Math.min(100, Math.max(8, parseFloat(avgProcessingHours || 0) * 15))}%`,
                      }}
                    />
                  </div>
                  <span className="admin-metric-card__bar-label">
                    {parseFloat(avgProcessingHours) > 0 ? 'Dữ liệu thực tế' : 'Chưa có dữ liệu duyệt'}
                  </span>
                </div>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-card__header">
                <span className="admin-metric-card__label">TỶ LỆ DUYỆT HỒ SƠ</span>
                <div className="admin-metric-card__icon-box" style={{ color: '#059669' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="admin-metric-card__main-row">
                  <span className="admin-metric-card__number">
                    {approvalRate}<span className="unit">%</span>
                  </span>
                </div>
                <p className="admin-metric-card__subtext">
                  Đạt tiêu chuẩn hợp quy định & pháp lý hợp lệ
                </p>
              </div>
            </div>
          </div>

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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="admin-shops-search-input"
                  placeholder="Tìm kiếm tên shop, CCCD, SĐT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                className="admin-shops-filter-btn"
                title="Làm mới danh sách hồ sơ"
                onClick={() => {
                  fetchCounts();
                  fetchShops();
                  showToast('Đã làm mới danh sách hồ sơ');
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#737373' }}>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>Đang tải danh sách hồ sơ...</div>
            </div>
          ) : shops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #ECEAE5' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: '0 0 4px' }}>
                Không tìm thấy hồ sơ phù hợp
              </h4>
              <p style={{ fontSize: '13px', color: '#737373', margin: 0 }}>
                Trạng thái <strong>{STATUS_TABS.find(t => t.key === activeTab)?.label}</strong> hiện tại không có dữ liệu phù hợp.
              </p>
            </div>
          ) : (
            <div className="admin-shops-list">
              {shops.map((app) => (
                <ShopCard
                  key={app._id}
                  app={app}
                  onApprove={handleApprove}
                  onReject={setRejectTarget}
                  onViewDoc={setPreviewDoc}
                  onViewApplicant={setViewingApplicant}
                />
              ))}
            </div>
          )}

          {total > 0 && (
            <div className="admin-shops-pagination">
              <div className="admin-shops-pagination__info">
                Hiển thị {shops.length > 0 ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} trong số {total} đơn {STATUS_TABS.find(t => t.key === activeTab)?.label?.toLowerCase()}
              </div>

              <div className="admin-shops-pagination__pages">
                <button
                  className="admin-shops-page-item"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
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
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

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
          <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
