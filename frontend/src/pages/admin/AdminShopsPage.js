import React, { useState, useEffect, useCallback } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const ADMIN_ID = process.env.REACT_APP_ADMIN_ID || 'ADMIN-PLACEHOLDER';

const STATUS_TABS = [
  { key: 'PENDING',  label: 'Cho Duyet' },
  { key: 'ACTIVE',   label: 'Da Duyet' },
  { key: 'REJECTED', label: 'Tu Choi' },
];

function StatusBadge({ status }) {
  const map = {
    PENDING:   { label: 'Dang ky moi',    bg: '#E8F5E9', color: '#2E7D32' },
    ACTIVE:    { label: 'Da duyet',        bg: '#E3F2FD', color: '#1565C0' },
    REJECTED:  { label: 'Tu choi',         bg: '#FFEBEE', color: '#C62828' },
    SUSPENDED: { label: 'Tam ngung',       bg: '#FFF3E0', color: '#E65100' },
  };
  const cfg = map[status] || { label: status, bg: '#F5F5F5', color: '#555' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      borderRadius: '20px', padding: '3px 10px',
      fontSize: '11px', fontWeight: 600, display: 'inline-block',
    }}>
      {cfg.label}
    </span>
  );
}

function RejectModal({ app, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    await onConfirm(app._id, reason, notes);
    setLoading(false);
  };

  return (
    <div style={ms.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...ms.modal, maxWidth: '500px' }}>
        <div style={ms.mHeader}>
          <div>
            <div style={ms.mTag}>TU CHOI HO SO</div>
            <h5 style={ms.mTitle}>{app.name}</h5>
          </div>
          <button onClick={onClose} style={ms.closeBtn}>x</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={ms.label}>Ly do tu choi <span style={{ color: '#C62828' }}>*</span></label>
            <textarea
              className="form-control mt-1"
              rows={3}
              placeholder="Mo ta cu the ly do tu choi de gui cho nguoi dang ky..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ fontSize: '13px', borderColor: reason.trim() ? '#dee2e6' : '#f87171', resize: 'vertical' }}
            />
            {!reason.trim() && (
              <div style={{ color: '#C62828', fontSize: '11px', marginTop: '4px' }}>
                Ly do tu choi la bat buoc.
              </div>
            )}
          </div>
          <div>
            <label style={ms.label}>Ghi chu noi bo (khong hien thi cho shop)</label>
            <textarea
              className="form-control mt-1"
              rows={2}
              placeholder="Ghi chu them..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ fontSize: '13px', resize: 'vertical' }}
            />
          </div>
          <div className="d-flex gap-2 justify-content-end pt-1">
            <button className="btn btn-light" onClick={onClose} disabled={loading}>Huy</button>
            <button
              className="btn btn-danger"
              onClick={handleSubmit}
              disabled={loading || !reason.trim()}
              style={{ opacity: reason.trim() ? 1 : 0.5 }}
            >
              {loading ? 'Dang xu ly...' : 'Xac Nhan Tu Choi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocCard({ label, filename }) {
  return (
    <div style={{
      border: '1px solid #E8E8E8', borderRadius: '8px',
      padding: '10px 14px', display: 'flex', alignItems: 'center',
      gap: '10px', background: '#FAFAFA', flex: 1,
    }}>
      <div style={{
        width: '32px', height: '32px', background: '#FFEBEE',
        borderRadius: '6px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ fontSize: '14px', color: '#C62828' }}>PDF</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A1A' }}>{label}</div>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filename || 'Da tai len'}
        </div>
        <div style={{ fontSize: '10px', color: '#1565C0', marginTop: '2px' }}>Da tai len</div>
      </div>
      <button style={{ border: 'none', background: 'none', color: '#888', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
        Xem
      </button>
    </div>
  );
}

function ShopCard({ app, onApprove, onReject }) {
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    await onApprove(app._id, '');
    setApproving(false);
  };

  const formatDateTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — ${d.toLocaleDateString('vi-VN')}`;
  };

  const docFilename = (url) => {
    if (!url) return '';
    return url.split('/').pop() || 'tai-lieu.pdf';
  };

  return (
    <div style={{
      border: '1px solid #EBEBEB', borderRadius: '12px',
      padding: '20px 24px', background: '#fff', marginBottom: '12px',
    }}>
      <div className="row g-0">
        <div className="col-lg-7" style={{ paddingRight: '24px', borderRight: '1px solid #F0F0F0' }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <span style={{ fontSize: '12px', color: '#888' }}>{formatDateTime(app.createdAt)}</span>
            <StatusBadge status={app.status} />
          </div>

          <h5 style={{ fontWeight: 700, fontSize: '18px', color: '#111', marginBottom: '2px' }}>{app.name}</h5>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '14px' }}>
            Nganh hang: {app.description?.slice(0, 60) || '—'}
          </div>

          <div style={{
            background: '#F8F8F8', borderRadius: '8px', padding: '12px 16px',
            display: 'flex', gap: '24px', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '3px' }}>Chu So Huu</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1A1A1A' }}>{app.ownerId?.fullName || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '3px' }}>Email</div>
              <div style={{ fontSize: '13px', color: '#1A1A1A' }}>{app.ownerId?.email || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '3px' }}>Dien Thoai</div>
              <div style={{ fontSize: '13px', color: '#1A1A1A' }}>{app.phone}</div>
            </div>
          </div>

          {app.notes && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#555', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ color: '#888' }}>i</span>
              <span>{app.notes}</span>
            </div>
          )}
        </div>

        <div className="col-lg-5" style={{ paddingLeft: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>
            Ho So Dinh Kem Tham Dinh
          </div>

          <div className="d-flex gap-2 mb-2 flex-wrap">
            <DocCard label="Giay DKKD" filename={docFilename(app.businessLicenseUrl)} />
            <DocCard label="CCCD 2 mat" filename={docFilename(app.idCardFrontUrl)} />
          </div>

          {app.status === 'PENDING' && (
            <div className="d-flex gap-2 justify-content-end mt-3">
              <button
                className="btn btn-outline-danger btn-sm"
                style={{ padding: '7px 20px', fontWeight: 600 }}
                onClick={() => onReject(app)}
              >
                Tu Choi
              </button>
              <button
                className="btn btn-success btn-sm"
                style={{ padding: '7px 20px', fontWeight: 600, background: '#1B8A4E', borderColor: '#1B8A4E' }}
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? 'Dang xu ly...' : 'Phe Duyet'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <div className="d-flex align-items-center justify-content-between mt-3">
      <div style={{ fontSize: '13px', color: '#888' }}>
        Trang {page} / {totalPages}
      </div>
      <nav>
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => onPageChange(page - 1)}>Truoc</button>
          </li>
          {pages.map(p => (
            <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
              <button className="page-link" onClick={() => onPageChange(p)}
                style={p === page ? { background: '#1A1A1A', borderColor: '#1A1A1A' } : {}}>
                {p}
              </button>
            </li>
          ))}
          <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => onPageChange(page + 1)}>Sau</button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default function AdminShopsPage() {
  const [activeTab, setActiveTab] = useState('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);

  const [shops, setShops] = useState([]);
  const [counts, setCounts] = useState({ PENDING: 0, ACTIVE: 0, REJECTED: 0 });
  const [avgTime] = useState('3.5');
  const [approvalRate] = useState('94.2');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 5;

  const fetchCounts = useCallback(async () => {
    try {
      const [p, a, r] = await Promise.all([
        fetch(`${API_BASE}/api/admin/shops?status=PENDING&limit=1`).then(r => r.json()),
        fetch(`${API_BASE}/api/admin/shops?status=ACTIVE&limit=1`).then(r => r.json()),
        fetch(`${API_BASE}/api/admin/shops?status=REJECTED&limit=1`).then(r => r.json()),
      ]);
      setCounts({
        PENDING: p.total || 0,
        ACTIVE: a.total || 0,
        REJECTED: r.total || 0,
      });
    } catch (_) {}
  }, []);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        status: activeTab,
        search: searchQuery,
        page,
        limit: LIMIT,
      });
      const res = await fetch(`${API_BASE}/api/admin/shops?${params}`);
      const data = await res.json();
      if (data.success) {
        setShops(data.data);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (_) {
      setError('Khong the ket noi den server.');
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

  const handleApprove = async (shopId, notes) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/shops/${shopId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: ADMIN_ID, notes }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      await fetchShops();
      await fetchCounts();
    } catch (err) {
      alert('Loi: ' + err.message);
    }
  };

  const handleRejectConfirm = async (shopId, rejectionReason, notes) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/shops/${shopId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: ADMIN_ID, rejectionReason, notes }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setRejectTarget(null);
      await fetchShops();
      await fetchCounts();
    } catch (err) {
      alert('Loi: ' + err.message);
    }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
      />

      <div className="admin-main-viewport">
        <AdminTopHeader
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          breadcrumb="Phe Duyet Shop"
        />

        <div className="admin-content-body" style={{ background: '#F7F7F7', minHeight: '100vh' }}>
          <div style={{ marginBottom: '6px' }}>
            <h4 style={{ fontWeight: 700, fontSize: '22px', color: '#111', marginBottom: '4px' }}>
              Phe Duyet Gian Hang Moi
            </h4>
            <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
              Xem xet ho so dang ky mo shop, kiem tra giay phep kinh doanh va CCCD cua nguoi dang ky.
            </p>
          </div>

          <div className="row g-3 mb-4" style={{ marginTop: '0' }}>
            <div className="col-md-4">
              <div style={card.wrapper}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                  CHO PHE DUYET
                </div>
                <div style={{ fontSize: '36px', fontWeight: 800, color: '#111', lineHeight: 1 }}>
                  {counts.PENDING}
                </div>
                <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '6px' }}>
                  +3 moi nop hom nay
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Yeu cau hoan thien tham dinh trong 24 gio
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div style={card.wrapper}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                  THOI GIAN XU LY TB
                </div>
                <div style={{ fontSize: '36px', fontWeight: 800, color: '#111', lineHeight: 1 }}>
                  {avgTime} <span style={{ fontSize: '16px', fontWeight: 400, color: '#666' }}>gio</span>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <div className="progress" style={{ height: '6px', borderRadius: '3px' }}>
                    <div className="progress-bar bg-success" style={{ width: '68%' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '4px' }}>
                    Nhanh hon 18%
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div style={card.wrapper}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>
                  TY LE DUYET HO SO
                </div>
                <div style={{ fontSize: '36px', fontWeight: 800, color: '#111', lineHeight: 1 }}>
                  {approvalRate}<span style={{ fontSize: '20px' }}>%</span>
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                  Dat tieu chuan hop quy dinh & phap ly hop le
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #EBEBEB', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div className="d-flex gap-1" style={{ background: '#F5F5F5', borderRadius: '8px', padding: '4px' }}>
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      border: 'none', borderRadius: '6px', padding: '7px 16px',
                      fontSize: '13px', cursor: 'pointer',
                      background: activeTab === tab.key ? '#fff' : 'transparent',
                      color: activeTab === tab.key ? '#111' : '#888',
                      fontWeight: activeTab === tab.key ? 600 : 400,
                      boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    {tab.label}
                    <span style={{
                      background: activeTab === tab.key ? '#111' : '#DDD',
                      color: activeTab === tab.key ? '#fff' : '#666',
                      borderRadius: '20px', padding: '1px 7px', fontSize: '11px', fontWeight: 700,
                    }}>
                      {counts[tab.key] || 0}
                    </span>
                  </button>
                ))}
              </div>

              <div className="d-flex gap-2 align-items-center">
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Tim kiem ten shop, CCCD, SDT..."
                    style={{ paddingLeft: '12px', fontSize: '13px', width: '260px', borderRadius: '8px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="btn btn-outline-secondary btn-sm" style={{ borderRadius: '8px', padding: '5px 10px' }}>
                  Bo loc
                </button>
              </div>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {error && (
                <div className="alert alert-danger py-2 mb-3" style={{ fontSize: '13px' }}>{error}</div>
              )}

              {loading ? (
                <div className="text-center py-5 text-muted" style={{ fontSize: '13px' }}>
                  Dang tai du lieu...
                </div>
              ) : shops.length === 0 ? (
                <div className="text-center py-5">
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>--</div>
                  <div style={{ fontWeight: 600, color: '#333' }}>Khong co ho so nao</div>
                  <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>
                    Tat ca ho so o trang thai nay da duoc xu ly.
                  </div>
                </div>
              ) : (
                <>
                  {shops.map(app => (
                    <ShopCard
                      key={app._id}
                      app={app}
                      onApprove={handleApprove}
                      onReject={setRejectTarget}
                    />
                  ))}

                  <div style={{ borderTop: '1px solid #F0F0F0', paddingTop: '14px' }}>
                    <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>
                      Hien thi 1–{shops.length} trong so {total} don cho duyet
                    </div>
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {rejectTarget && (
        <RejectModal
          app={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  );
}

const card = {
  wrapper: {
    background: '#fff', borderRadius: '12px',
    border: '1px solid #EBEBEB', padding: '20px 22px',
    height: '100%',
  },
};

const ms = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  modal: {
    background: '#fff', borderRadius: '14px',
    width: '100%', maxWidth: '960px',
    maxHeight: '90vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
  },
  mHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px 16px', borderBottom: '1px solid #F0F0F0',
  },
  mTag: {
    fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
    color: '#888', marginBottom: '4px', textTransform: 'uppercase',
  },
  mTitle: {
    fontSize: '17px', fontWeight: 700, color: '#111', margin: 0,
  },
  closeBtn: {
    background: '#F5F5F5', border: 'none', borderRadius: '6px',
    width: '30px', height: '30px', cursor: 'pointer',
    fontSize: '14px', color: '#555',
  },
  label: {
    fontSize: '12px', fontWeight: 600, color: '#444',
  },
};
