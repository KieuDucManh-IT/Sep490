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
    // Khi mở hoặc hủy chỉnh sửa, lấy lại dữ liệu đã lưu.
    setUserInfo(getProfile(user));
    setIsEditing((previous) => !previous);
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
            className="btn-primary"
            style={{ fontSize: "12px" }}
            onClick={handleToggleEdit}
          >
            {isEditing
              ? "✕ HỦY CHỈNH SỬA"
              : "✎ CHỈNH SỬA THÔNG TIN"}
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
              className="profile-nav-btn active"
              onClick={() => {
                setIsEditing(false);
                setUserInfo(getProfile(user));
                setNotice("");
              }}
            >
              <span>👤 Thông Tin Cá Nhân</span>
              <span>›</span>
            </button>

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

            {!isEditing ? (
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
              <form
                onSubmit={handleSave}
                className="auth-form"
              >
                <p
                  style={{
                    fontSize: "13px",
                    color: "#666",
                    lineHeight: 1.6,
                  }}
                >
                  Form chỉnh sửa chưa kết nối API lưu hồ sơ.
                  Thông tin tài khoản chưa thay đổi khi bạn nhập
                  vào các ô bên dưới.
                </p>

                <div className="form-group">
                  <label htmlFor="profile-fullName">
                    HỌ VÀ TÊN
                  </label>

                  <input
                    id="profile-fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    value={userInfo.fullName}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profile-email">
                    ĐỊA CHỈ EMAIL
                  </label>

                  <input
                    id="profile-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={userInfo.email}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profile-phone">
                    SỐ ĐIỆN THOẠI
                  </label>

                  <input
                    id="profile-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={userInfo.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profile-address">
                    ĐỊA CHỈ LIÊN HỆ
                  </label>

                  <input
                    id="profile-address"
                    name="address"
                    type="text"
                    autoComplete="street-address"
                    value={userInfo.address}
                    onChange={handleChange}
                  />
                </div>

                {notice && (
                  <p
                    role="status"
                    style={{
                      fontSize: "13px",
                      color: "#B45309",
                      lineHeight: 1.6,
                    }}
                  >
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    width: "100%",
                    marginTop: "12px",
                  }}
                >
                  LƯU THAY ĐỔI HỒ SƠ
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}