import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/AuthLayout.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export default function RegisterShopPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    city: 'Hà Nội',
    district: 'Hoàn Kiếm',
    imageUrl: '',
    businessLicenseUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c',
    idCardFrontUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
    idCardBackUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
    agreeTerms: false,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedData, setSubmittedData] = useState(null);

  const fillSampleData = () => {
    setFormData({
      name: 'Vestora Premier Atelier',
      description: 'Chuyên cung cấp và cho thuê trang phục dạ tiệc cao cấp, váy cưới thiết kế và âu phục sang trọng chuẩn may đo thủ công.',
      phone: '0912345678',
      address: '88 Phố Huế, Phường Hàng Bài',
      city: 'Hà Nội',
      district: 'Hoàn Kiếm',
      imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
      businessLicenseUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c',
      idCardFrontUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
      idCardBackUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
      agreeTerms: true,
    });
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim() || !formData.description.trim() || !formData.phone.trim() || !formData.address.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    if (!formData.agreeTerms) {
      setErrorMsg('Vui lòng đánh dấu đồng ý với Điều Khoản Dịch Vụ Shop Owner.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/shops/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          district: formData.district.trim(),
          imageUrl: formData.imageUrl.trim(),
          businessLicenseUrl: formData.businessLicenseUrl.trim(),
          idCardFrontUrl: formData.idCardFrontUrl.trim(),
          idCardBackUrl: formData.idCardBackUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Không thể gửi hồ sơ.');
      }

      setSubmittedData(data.data);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi kết nối đến máy chủ backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubmittedData(null);
    setFormData({
      name: '',
      description: '',
      phone: '',
      address: '',
      city: 'Hà Nội',
      district: 'Hoàn Kiếm',
      imageUrl: '',
      businessLicenseUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c',
      idCardFrontUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
      idCardBackUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
      agreeTerms: false,
    });
    setErrorMsg('');
  };

  return (
    <div className="auth-layout" style={{ background: '#FBF9F5', minHeight: '100vh' }}>
      <aside className="auth-brand" style={{ background: '#171717', color: '#FFF' }}>
        <a href="/" className="auth-brand__logo" style={{ textDecoration: 'none', color: '#FFF' }}>
          <span className="auth-brand__logo-name">VESTORA</span>
        </a>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '1.5px' }}>
            CONG DOI TAC GIAN HANG VESTORA
          </div>

          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '34px', lineHeight: 1.25, margin: 0 }}>
            Mo gian hang tren VESTORA — ket noi hang ngan khach hang thue thoi trang cao cap.
          </h1>

          <p style={{ fontSize: '14px', color: '#A3A3A3', lineHeight: 1.6, margin: 0 }}>
            He thong van hanh chuyen nghiep voi quan ly lich thue thong minh, bao chung thanh toan escrow va ho tro truyen thong toan dien.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Bao Chung Coc Tu Dong</div>
              <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Phong toa va quyet toan tien coc tu dong, bao dam an toan tuyet doi cho bo suu tap.</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Quan Ly Kho & Lich Thue 24/7</div>
              <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Tranh trung lich khach thue, dong bo trang thai giao nhan theo thoi gian thuc.</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Mien Phi Khoi Tao Gian Hang</div>
              <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Thu tuc xet duyet ho so truc tuyen nhanh chong trong 24 den 48 gio lam viec.</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="auth-form-panel py-4">
        <div className="auth-form-container" style={{ maxWidth: '680px' }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span style={{ fontSize: '11px', color: '#666', fontWeight: 600, letterSpacing: '1px' }}>
              QUY TRINH DOI TAC • GIAI DOAN 1
            </span>
            {!submittedData && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={fillSampleData}
                style={{ fontSize: '11px', borderRadius: '6px' }}
              >
                Dien du lieu mau
              </button>
            )}
          </div>

          <h2 className="auth-form-title mb-1" style={{ fontSize: '26px' }}>Dang Ky Ho So Gian Hang</h2>
          <p className="auth-form-subtitle mb-4" style={{ fontSize: '13px', color: '#666' }}>
            Cung cap day du thong tin phap ly va gian hang de Admin tham dinh mo tai khoan Shop Owner.
          </p>

          {errorMsg && (
            <div className="alert alert-danger py-2 px-3 mb-3" role="alert" style={{ fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          {submittedData ? (
            <div className="card border-0 shadow-sm p-4 text-center" style={{ borderRadius: '16px', background: '#FFFFFF' }}>
              <div className="badge bg-success-subtle text-success px-3 py-2 mb-3 mx-auto" style={{ fontSize: '13px', fontWeight: 600 }}>
                HO SO DANG KY THANH CONG
              </div>
              <h4 className="fw-bold text-dark mb-2">{submittedData.shopName}</h4>
              <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                Ho so cua ban da duoc luu vao he thong va dang o trang thai tham dinh boi quan tri vien.
              </p>

              <div className="bg-light p-3 rounded-3 text-start mb-4" style={{ fontSize: '13px' }}>
                <div className="d-flex justify-content-between py-1 border-bottom">
                  <span className="text-muted">Ma ho so:</span>
                  <span className="fw-bold font-monospace">{submittedData.applicationCode}</span>
                </div>
                <div className="d-flex justify-content-between py-1 border-bottom">
                  <span className="text-muted">Trang thai:</span>
                  <span className="badge bg-warning text-dark">{submittedData.status}</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">Thoi gian nop:</span>
                  <span>{new Date(submittedData.submittedAt).toLocaleString('vi-VN')}</span>
                </div>
              </div>

              <div className="d-flex gap-2 justify-content-center">
                <Link to="/admin/shops" className="btn btn-dark px-4 py-2" style={{ fontSize: '13px' }}>
                  Xem tai trang Quan Tri Duyet Shop
                </Link>
                <button className="btn btn-outline-secondary px-3 py-2" onClick={handleReset} style={{ fontSize: '13px' }}>
                  Nop ho so khac
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="card border-0 shadow-sm p-4 mb-3" style={{ borderRadius: '16px', background: '#FFFFFF' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>I. Thong Tin Gian Hang</span>
                  <span className="text-danger fw-bold" style={{ fontSize: '11px' }}>BAT BUOC</span>
                </div>

                <div className="mb-3">
                  <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    TEN GIAN HANG *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="VD: Vestora Haute Couture"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{ fontSize: '13px' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    MO TA GIOI THIEU *
                  </label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Gioi thieu dinh vi trang phuc, dong san pham thue chu dao..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    maxLength={1000}
                    style={{ fontSize: '13px' }}
                  />
                  <div className="text-end text-muted mt-1" style={{ fontSize: '11px' }}>
                    {formData.description.length} / 1000 ky tu
                  </div>
                </div>

                <div>
                  <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    LINK ANH GIAN HANG / LOGO (KHONG BAT BUOC)
                  </label>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="https://..."
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>

              <div className="card border-0 shadow-sm p-4 mb-3" style={{ borderRadius: '16px', background: '#FFFFFF' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>II. Thong Tin Lien He & Dia Chi</span>
                  <span className="text-danger fw-bold" style={{ fontSize: '11px' }}>BAT BUOC</span>
                </div>

                <div className="mb-3">
                  <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    SO DIEN THOAI LIEN HE *
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="VD: 0987654321"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    style={{ fontSize: '13px' }}
                  />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                      TINH / THANH PHO
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                      QUAN / HUYEN
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    DIA CHI GIAN HANG *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="So nha, ten duong, phuong/xa..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    style={{ fontSize: '13px' }}
                  />
                </div>
              </div>

              <div className="card border-0 shadow-sm p-4 mb-3" style={{ borderRadius: '16px', background: '#FFFFFF' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>III. Giay To Phap Ly & Xac Minh</span>
                  <span className="text-muted" style={{ fontSize: '11px' }}>HO SO DINH KEM</span>
                </div>

                <div className="mb-3">
                  <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                    LINK GIAY PHEP DANG KY KINH DOANH (GPKD)
                  </label>
                  <input
                    type="url"
                    className="form-control"
                    value={formData.businessLicenseUrl}
                    onChange={(e) => setFormData({ ...formData, businessLicenseUrl: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                      LINK ANH CCCD MAT TRUOC
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      value={formData.idCardFrontUrl}
                      onChange={(e) => setFormData({ ...formData, idCardFrontUrl: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label text-secondary fw-semibold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                      LINK ANH CCCD MAT SAU
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      value={formData.idCardBackUrl}
                      onChange={(e) => setFormData({ ...formData, idCardBackUrl: e.target.value })}
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div className="form-check mt-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="agreeTermsCheck"
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                    required
                  />
                  <label className="form-check-label text-secondary" htmlFor="agreeTermsCheck" style={{ fontSize: '12px', lineHeight: 1.5 }}>
                    Toi cam ket cac thong tin va giay to cung cap la chinh xac, dong thoi dong y voi Dieu Khoan Hop Tac Gian Hang cua VESTORA.
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-dark w-100 py-3 fw-semibold text-uppercase"
                disabled={loading}
                style={{ borderRadius: '12px', fontSize: '13px', letterSpacing: '1px' }}
              >
                {loading ? 'Dang xu ly gui ho so...' : 'Gui Dang Ky Ho So Gian Hang'}
              </button>
            </form>
          )}

          <div className="text-center mt-3" style={{ fontSize: '13px', color: '#666' }}>
            Da co gian hang da duoc phe duyet?{' '}
            <Link to="/shop/dashboard" style={{ color: 'var(--color-gold-deep)', fontWeight: 600, textDecoration: 'none' }}>
              Truy cap kenh chu shop
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
