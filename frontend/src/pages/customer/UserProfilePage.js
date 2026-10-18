import React, { useEffect, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { useAuth } from "../../context/AuthContext";

import "../../styles/UserProfile.css";

const ROLE_LABELS = {
  customer: "Khách hàng",
  shop_owner: "Chủ cửa hàng",
  admin: "Quản trị viên",
  operation_staff: "Nhân viên vận hành",
};

function getProfile(user) {
  return {
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.information?.[0]?.Phone || "",
    address: user?.information?.[0]?.Address || "",
  };
}

export default function UserProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    loading,
    authError,
    refreshUser,
    logout,
  } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileTab, setProfileTab] = useState("information");
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [notice, setNotice] = useState("");
  const [failedAvatar, setFailedAvatar] = useState("");

  const [userInfo, setUserInfo] = useState(() =>
    getProfile(user)
  );

  // User được lấy bất đồng bộ khi reload trang.
  // Cập nhật form sau khi AuthContext nhận được dữ liệu.
  useEffect(() => {
    setUserInfo(getProfile(user));
    setIsEditing(false);
    setNotice("");
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setUserInfo((previous) => ({
      ...previous,
      [name]: value,
    }));

    setNotice("");
  };

  const handleToggleEdit = () => {
    setProfileTab("information");
    setProfileMenuOpen(true);
    setUserInfo(getProfile(user));

    setIsEditing((previous) =>
      profileTab === "information" ? !previous : true
    );

    setNotice("");
  };

  const handleSave = (event) => {
    event.preventDefault();

    // Chưa có API cập nhật hồ sơ trong phần login.
    // Không thay dữ liệu tài khoản hoặc báo lưu thành công giả.
    setNotice(
      "Chưa lưu thay đổi: chức năng cập nhật hồ sơ chưa được kết nối với backend."
    );
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await logout();

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      setLogoutError(
        error.message || "Đăng xuất thất bại. Vui lòng thử lại."
      );
    } finally {
      setLoggingOut(false);
    }
  };

  // Chờ /auth/me hoàn tất trước khi quyết định chuyển về login.
  if (loading) {
    return (
      <div className="profile-page-container">
        <Navbar />

        <div
          role="status"
          style={{
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          Đang tải thông tin tài khoản...
        </div>

        <Footer />
      </div>
    );
  }

  // Lỗi mạng không đồng nghĩa với đã đăng xuất.
  if (!user && authError) {
    return (
      <div className="profile-page-container">
        <Navbar />

        <div
          role="alert"
          style={{
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          <p>{authError}</p>

          <button
            type="button"
            className="btn-primary"
            onClick={refreshUser}
          >
            Thử lại
          </button>
        </div>

        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  const profile = getProfile(user);
  const roleLabel = ROLE_LABELS[user.role] || user.role;

  const avatarInitial =
    user.fullName?.trim().charAt(0).toUpperCase() || "U";

  const showAvatar =
    Boolean(user.avatar) && failedAvatar !== user.avatar;

  return (
    <div className="profile-page-container">
      <Navbar />

      {/* Header */}
      <div className="profile-header-hero">
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "1px",
            color: "#666",
            marginBottom: "8px",
          }}
        >
          TRANG CHỦ &gt; TÀI KHOẢN &gt; THÔNG TIN CÁ NHÂN
        </div>

        <div
          style={{
            fontSize: "10px",
            color: "var(--color-gold-deep)",
            fontWeight: 700,
            letterSpacing: "1.5px",
            marginBottom: "4px",
          }}
        >
          HỒ SƠ TÀI KHOẢN
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-title)",
                fontSize: "40px",
                margin: "0 0 6px",
              }}
            >
              Thông Tin Cá Nhân
            </h1>

            <p
              style={{
                fontSize: "14px",
                color: "#666",
                margin: 0,
              }}
            >
              Thông tin tài khoản của bạn trên VESTORA.
            </p>
          </div>

          <button
            type="button"
            className="profile-edit-toggle"
            onClick={handleToggleEdit}
          >
            {isEditing ? "Đóng chỉnh sửa" : "Chỉnh sửa thông tin"}
          </button>
        </div>
      </div>

      <div className="profile-main-grid">
        {/* Sidebar */}
        <aside className="user-sidebar-card">
          <div className="user-avatar-wrapper">
            {showAvatar ? (
              <img
                src={user.avatar}
                alt={`Ảnh đại diện của ${profile.fullName}`}
                className="user-avatar-img"
                onError={() => setFailedAvatar(user.avatar)}
              />
            ) : (
              <div
                className="user-avatar-img"
                aria-label="Ảnh đại diện mặc định"
                style={{
                  display: "grid",
                  placeItems: "center",
                  background: "#eee7dc",
                  color: "#96723d",
                  fontSize: "42px",
                  fontWeight: 700,
                }}
              >
                {avatarInitial}
              </div>
            )}
          </div>

          <h2
            style={{
              fontFamily: "var(--font-title)",
              fontSize: "22px",
              margin: "0 0 4px",
              overflowWrap: "anywhere",
            }}
          >
            {profile.fullName}
          </h2>

          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "12px",
              overflowWrap: "anywhere",
            }}
          >
            {profile.email}
          </div>

          <span
            style={{
              background: "#ECFDF5",
              color: "#059669",
              fontSize: "11px",
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: "9999px",
            }}
          >
            {roleLabel}
          </span>

          <div className="profile-nav-menu">
            <button
              type="button"
              className={`profile-nav-btn profile-menu-parent ${profileMenuOpen ? "is-open" : ""
                }`}
              onClick={() => setProfileMenuOpen((previous) => !previous)}
              aria-expanded={profileMenuOpen}
              aria-controls="profile-account-submenu"
            >
              <span>Thông tin cá nhân</span>

              <svg
                className="profile-menu-chevron"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {profileMenuOpen && (
              <div
                id="profile-account-submenu"
                className="profile-account-submenu"
              >
                <button
                  type="button"
                  className={`profile-submenu-button ${profileTab === "information" && isEditing
                    ? "is-active"
                    : ""
                    }`}
                  onClick={() => {
                    setProfileTab("information");
                    setUserInfo(getProfile(user));
                    setIsEditing(true);
                    setNotice("");
                  }}
                >
                  <span className="profile-submenu-icon">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
                      <path d="m13 6 5 5" />
                    </svg>
                  </span>

                  <span>Chỉnh sửa thông tin</span>
                </button>

                <button
                  type="button"
                  className={`profile-submenu-button ${profileTab === "password" ? "is-active" : ""
                    }`}
                  onClick={() => {
                    setProfileTab("password");
                    setUserInfo(getProfile(user));
                    setIsEditing(false);
                    setNotice("");
                  }}
                >
                  <span className="profile-submenu-icon">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="5" y="10" width="14" height="11" rx="3" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      <path d="M12 14v3" />
                    </svg>
                  </span>

                  <span>Đổi mật khẩu</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="profile-nav-btn"
              onClick={() => navigate("/cart")}
            >
              <span>🛍️ Giỏ Hàng Của Tôi</span>
              <span>›</span>
            </button>

            <button
              type="button"
              className="profile-nav-btn"
              onClick={() => navigate("/favorites")}
            >
              <span>♡ Sản Phẩm Yêu Thích</span>
              <span>›</span>
            </button>

            <button
              type="button"
              className="profile-nav-btn"
              onClick={() => navigate("/try-on-photo")}
            >
              <span>👗 Thử Đồ Với Ảnh</span>
              <span>›</span>
            </button>

            <button
              type="button"
              className="profile-nav-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                color: "#DC2626",
                marginTop: "16px",
                borderTop: "1px solid #F3F4F6",
                paddingTop: "12px",
                opacity: loggingOut ? 0.6 : 1,
              }}
            >
              <span>
                {loggingOut
                  ? "Đang đăng xuất..."
                  : "🚪 Đăng Xuất Tài Khoản"}
              </span>
            </button>

            {logoutError && (
              <p
                role="alert"
                style={{
                  color: "#DC2626",
                  fontSize: "13px",
                  padding: "0 12px",
                }}
              >
                {logoutError}
              </p>
            )}
          </div>
        </aside>

        {/* Chi tiết hồ sơ */}
        <div className="profile-details-panel">
          <div className="info-card-white">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "24px",
                borderBottom: "1px solid #F3F4F6",
                paddingBottom: "16px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-title)",
                    fontSize: "20px",
                    margin: 0,
                  }}
                >
                  Hồ Sơ Thành Viên
                </h3>

                <p
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    margin: "6px 0 0",
                  }}
                >
                  Thông tin được lấy từ tài khoản đang đăng nhập.
                </p>
              </div>

              <span
                style={{
                  background: "#ECFDF5",
                  color: "#059669",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: "9999px",
                }}
              >
                {user.status === "active"
                  ? "ĐANG HOẠT ĐỘNG"
                  : "KHÔNG HOẠT ĐỘNG"}
              </span>
            </div>

            {profileTab === "password" ? (
              <section
                className="profile-password-section"
                aria-labelledby="profile-password-title"
              >
                <span className="profile-password-label">
                  BẢO MẬT TÀI KHOẢN
                </span>

                <h4 id="profile-password-title">Đổi mật khẩu</h4>

                <p>
                  Quản lý mật khẩu đăng nhập tài khoản VESTORA của bạn.
                </p>

                <div className="profile-password-placeholder" role="status">
                  Chức năng đổi mật khẩu hiện chưa khả dụng.
                </div>
              </section>
            ) : !isEditing ? (
              <div>
                <div className="profile-table-row">
                  <span style={{ color: "#666" }}>
                    Họ và tên
                  </span>

                  <strong>{profile.fullName}</strong>

                  <span />
                </div>

                <div className="profile-table-row">
                  <span style={{ color: "#666" }}>
                    Địa chỉ email
                  </span>

                  <strong
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {profile.email}
                  </strong>

                  <span />
                </div>

                <div className="profile-table-row">
                  <span style={{ color: "#666" }}>
                    Số điện thoại liên lạc
                  </span>

                  <strong>
                    {profile.phone || "Chưa cập nhật"}
                  </strong>

                  <span />
                </div>

                <div className="profile-table-row">
                  <span style={{ color: "#666" }}>
                    Địa chỉ liên hệ
                  </span>

                  <strong
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {profile.address || "Chưa cập nhật"}
                  </strong>

                  <span />
                </div>

                <div className="profile-table-row">
                  <span style={{ color: "#666" }}>
                    Vai trò tài khoản
                  </span>

                  <strong>{roleLabel}</strong>

                  <span />
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="vestora-profile-form">
                <div className="profile-edit-intro">
                  <span className="profile-edit-eyebrow">
                    THÔNG TIN CÁ NHÂN
                  </span>

                  <h4>Chỉnh sửa hồ sơ</h4>

                  <p>Cập nhật thông tin để VESTORA hỗ trợ bạn tốt hơn.</p>
                </div>

                <div className="profile-fields-grid">
                  <div className="profile-field">
                    <div className="profile-field-heading">
                      <label htmlFor="profile-fullName">Họ và tên</label>

                      <span className="profile-field-counter">
                        {[...userInfo.fullName].length}/25
                      </span>
                    </div>

                    <input
                      id="profile-fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      placeholder="Nhập họ và tên"
                      value={userInfo.fullName}
                      onChange={(event) => {
                        if ([...event.target.value].length <= 25) {
                          handleChange(event);
                        }
                      }}
                      required
                      aria-describedby="profile-name-hint"
                    />

                    <small id="profile-name-hint">
                      Họ tên tối đa 25 ký tự.
                    </small>
                  </div>

                  <div className="profile-field">
                    <div className="profile-field-heading">
                      <label htmlFor="profile-email">Địa chỉ email</label>

                      <span className="profile-readonly-badge">
                        Chỉ xem
                      </span>
                    </div>

                    <input
                      id="profile-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={userInfo.email}
                      readOnly
                      aria-describedby="profile-email-hint"
                    />

                    <small id="profile-email-hint">
                      Email đang dùng để đăng nhập tài khoản.
                    </small>
                  </div>

                  <div className="profile-field">
                    <div className="profile-field-heading">
                      <label htmlFor="profile-phone">Số điện thoại</label>
                      <span className="profile-field-optional">
                        Không bắt buộc
                      </span>
                    </div>

                    <input
                      id="profile-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="Nhập số điện thoại liên hệ"
                      value={userInfo.phone}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="profile-field profile-field-full">
                    <div className="profile-field-heading">
                      <label htmlFor="profile-address">Địa chỉ liên hệ</label>
                      <span className="profile-field-optional">
                        Không bắt buộc
                      </span>
                    </div>

                    <textarea
                      id="profile-address"
                      name="address"
                      autoComplete="street-address"
                      placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành phố"
                      rows={3}
                      value={userInfo.address}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {notice && (
                  <div className="profile-edit-notice" role="status">
                    {notice}
                  </div>
                )}

                <div className="profile-edit-actions">
                  <p>Kiểm tra thông tin trước khi lưu.</p>

                  <div className="profile-edit-buttons">
                    <button
                      type="button"
                      className="profile-cancel-button"
                      onClick={handleToggleEdit}
                    >
                      Hủy bỏ
                    </button>

                    <button
                      type="submit"
                      className="profile-save-button"
                    >
                      Lưu thay đổi
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}