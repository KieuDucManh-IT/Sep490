import React, { useEffect, useRef, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { useAuth } from "../../context/AuthContext";
import { changePasswordApi } from "../../services/authApi";

import "../../styles/UserProfile.css";

const ADDRESS_API = "https://provinces.open-api.vn/api/v2";

const ROLE_LABELS = {
  customer: "Khách hàng",
  shop_owner: "Chủ cửa hàng",
  admin: "Quản trị viên",
  operation_staff: "Nhân viên vận hành",
};

const PASSWORD_FIELDS = [
  {
    name: "currentPassword",
    label: "Mật khẩu hiện tại",
    placeholder: "Nhập mật khẩu đang sử dụng",
    autoComplete: "current-password",
  },
  {
    name: "newPassword",
    label: "Mật khẩu mới",
    placeholder: "Nhập mật khẩu mới",
    autoComplete: "new-password",
  },
  {
    name: "confirmNewPassword",
    label: "Xác nhận mật khẩu mới",
    placeholder: "Nhập lại mật khẩu mới",
    autoComplete: "new-password",
  },
];

const SELECT_STYLE = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 48,
  padding: "12px 14px",
  border: "1px solid #ded6ca",
  borderRadius: 10,
  backgroundColor: "#fff",
  color: "#40382f",
  fontFamily: "inherit",
  fontSize: 14,
};

const ERROR_STYLE = {
  marginTop: 16,
  padding: "12px 16px",
  border: "1px solid #f0cccc",
  borderRadius: 10,
  background: "#fff3f3",
  color: "#ab3838",
  fontSize: 14,
  lineHeight: 1.6,
};

function getProfile(user) {
  const information = user?.information?.[0] || {};

  return {
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: information.Phone || "",
    address: information.Address || "",
    provinceCode: String(information.ProvinceCode || ""),
    wardCode: String(information.WardCode || ""),
    addressDetail: information.AddressDetail || "",
  };
}

async function fetchAddress(path, signal) {
  const response = await fetch(`${ADDRESS_API}${path}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error("Không tải được danh mục địa chỉ");
  }

  return response.json();
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
    updateAvatar,
    updateProfile,
  } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(true);
  const [profileTab, setProfileTab] = useState("information");

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // Cập nhật thông tin cá nhân.
  const [userInfo, setUserInfo] = useState(() => getProfile(user));
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [notice, setNotice] = useState("");

  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [provinceError, setProvinceError] = useState("");
  const [wardError, setWardError] = useState("");
  const [addressRetry, setAddressRetry] = useState(0);

  const wardCache = useRef(new Map());

  // Avatar: chọn ảnh xong tự upload.
  const avatarInputRef = useRef(null);
  const [failedAvatar, setFailedAvatar] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // Đổi mật khẩu.
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Tránh gửi nhiều thao tác cập nhật tài khoản cùng lúc.
  const accountActionRef = useRef(false);

  const accountBusy =
    profileSaving ||
    avatarSaving ||
    changingPassword ||
    loggingOut;

  const savedProfileJson = JSON.stringify(getProfile(user));
  const savedUserId = user?.id;

  // Không ghi đè nội dung người dùng đang nhập.
  // Avatar không nằm trong savedProfileJson.
  useEffect(() => {
    if (!isEditing) {
      setUserInfo(JSON.parse(savedProfileJson));
    }
  }, [savedProfileJson, savedUserId, isEditing]);

  // Tải tỉnh/thành phố khi mở form chỉnh sửa.
  useEffect(() => {
    if (!isEditing) return;

    const controller = new AbortController();
    let active = true;

    const loadProvinces = async () => {
      setLoadingProvinces(true);
      setProvinceError("");

      try {
        const data = await fetchAddress("/p/", controller.signal);

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Danh sách Tỉnh/Thành phố chưa có dữ liệu");
        }

        if (active) {
          setProvinces(data);
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setProvinceError(
            error.message || "Không tải được danh sách Tỉnh/Thành phố"
          );
        }
      } finally {
        if (active) {
          setLoadingProvinces(false);
        }
      }
    };

    loadProvinces();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isEditing, addressRetry]);

  // Tải phường/xã tương ứng với tỉnh đã chọn.
  useEffect(() => {
    if (!isEditing) return;

    const provinceCode = userInfo.provinceCode;

    setWards([]);
    setWardError("");

    if (!provinceCode) {
      setLoadingWards(false);
      return;
    }

    const cached = wardCache.current.get(provinceCode);

    if (cached) {
      setWards(cached);
      setLoadingWards(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    const loadWards = async () => {
      setLoadingWards(true);

      try {
        const data = await fetchAddress(
          `/p/${encodeURIComponent(provinceCode)}?depth=2`,
          controller.signal
        );

        if (!Array.isArray(data.wards)) {
          throw new Error("Danh sách Phường/Xã không hợp lệ");
        }

        if (active) {
          wardCache.current.set(provinceCode, data.wards);
          setWards(data.wards);
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setWardError(
            error.message || "Không tải được danh sách Phường/Xã"
          );
        }
      } finally {
        if (active) {
          setLoadingWards(false);
        }
      }
    };

    loadWards();

    // Đổi tỉnh thì bỏ phản hồi của yêu cầu trước.
    return () => {
      active = false;
      controller.abort();
    };
  }, [isEditing, userInfo.provinceCode, addressRetry]);

  const handleChooseAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || accountActionRef.current) return;

    setAvatarError("");

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarError("Vui lòng chọn một tệp hình ảnh.");
      return;
    }

    accountActionRef.current = true;
    setAvatarSaving(true);

    try {
      await updateAvatar(file);
      setFailedAvatar("");
    } catch (error) {
      setAvatarError(
        error.message || "Không tải được ảnh. Vui lòng thử lại."
      );
    } finally {
      accountActionRef.current = false;
      setAvatarSaving(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setUserInfo((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "provinceCode" ? { wardCode: "" } : {}),
    }));

    setProfileError("");
    setNotice("");
  };

  const handleOpenEdit = () => {
    if (accountActionRef.current) return;

    setProfileTab("information");
    setProfileMenuOpen(true);
    setUserInfo(getProfile(user));
    setIsEditing(true);
    setProfileError("");
    setNotice("");
  };

  const handleCancelEdit = () => {
    if (accountActionRef.current) return;

    setUserInfo(getProfile(user));
    setIsEditing(false);
    setProfileError("");
    setNotice("");
  };

  const handleToggleEdit = () => {
    if (isEditing && profileTab === "information") {
      handleCancelEdit();
    } else {
      handleOpenEdit();
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (accountActionRef.current) return;

    setProfileError("");
    setNotice("");

    const fullName = userInfo.fullName
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ");

    if (!fullName || [...fullName].length > 25) {
      setProfileError("Họ tên phải có từ 1 đến 25 ký tự");
      return;
    }

    if (!/^[\p{L}\p{M} ]+$/u.test(fullName)) {
      setProfileError("Họ tên chỉ được chứa chữ cái và khoảng trắng");
      return;
    }

    let phone = userInfo.phone.trim().replace(/[\s().-]/g, "");

    if (phone.startsWith("+84")) {
      phone = `0${phone.slice(3)}`;
    }

    if (!/^0[35789]\d{8}$/.test(phone)) {
      setProfileError(
        "Vui lòng nhập số di động Việt Nam hợp lệ gồm 10 chữ số"
      );
      return;
    }

    if (
      loadingProvinces ||
      loadingWards ||
      provinceError ||
      wardError
    ) {
      setProfileError("Vui lòng tải đầy đủ danh mục địa chỉ trước khi lưu");
      return;
    }

    const selectedProvince = provinces.find(
      (item) => String(item.code) === userInfo.provinceCode
    );

    const selectedWard = wards.find(
      (item) => String(item.code) === userInfo.wardCode
    );

    if (!selectedProvince || !selectedWard) {
      setProfileError("Vui lòng chọn Tỉnh/Thành phố và Phường/Xã");
      return;
    }

    const addressDetail = userInfo.addressDetail
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ");

    if (!addressDetail || [...addressDetail].length > 200) {
      setProfileError("Địa chỉ chi tiết phải có từ 1 đến 200 ký tự");
      return;
    }

    accountActionRef.current = true;
    setProfileSaving(true);

    try {
      const result = await updateProfile({
        fullName,
        phone,
        provinceCode: userInfo.provinceCode,
        wardCode: userInfo.wardCode,
        addressDetail,
      });

      setUserInfo(getProfile(result.user));
      setIsEditing(false);
      setNotice(result.message || "Cập nhật hồ sơ thành công");
    } catch (error) {
      setProfileError(
        error.message || "Không cập nhật được hồ sơ. Vui lòng thử lại"
      );
    } finally {
      accountActionRef.current = false;
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    if (accountActionRef.current) return;

    accountActionRef.current = true;
    setLoggingOut(true);
    setLogoutError("");

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(
        error.message || "Đăng xuất thất bại. Vui lòng thử lại."
      );
    } finally {
      accountActionRef.current = false;
      setLoggingOut(false);
    }
  };

  const handleOpenPassword = () => {
    if (accountActionRef.current) return;

    setProfileTab("password");
    setUserInfo(getProfile(user));
    setIsEditing(false);
    setProfileError("");
    setNotice("");
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setPasswordErrors((previous) => ({
      ...previous,
      [name]: "",
      server: "",
    }));

    setPasswordSuccess("");
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (accountActionRef.current) return;

    setPasswordSuccess("");

    const {
      currentPassword,
      newPassword,
      confirmNewPassword,
    } = passwordForm;

    const nextErrors = {};
    const byteLength = (value) =>
      new TextEncoder().encode(value).length;

    if (!currentPassword) {
      nextErrors.currentPassword = "Vui lòng nhập mật khẩu hiện tại";
    } else if (byteLength(currentPassword) > 72) {
      nextErrors.currentPassword = "Mật khẩu hiện tại không hợp lệ";
    }

    if (!newPassword) {
      nextErrors.newPassword = "Vui lòng nhập mật khẩu mới";
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = "Mật khẩu mới phải có ít nhất 8 ký tự";
    } else if (byteLength(newPassword) > 72) {
      nextErrors.newPassword =
        "Mật khẩu mới không được vượt quá 72 byte";
    }

    if (!confirmNewPassword) {
      nextErrors.confirmNewPassword =
        "Vui lòng xác nhận mật khẩu mới";
    } else if (newPassword !== confirmNewPassword) {
      nextErrors.confirmNewPassword =
        "Mật khẩu xác nhận không khớp";
    }

    setPasswordErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    accountActionRef.current = true;
    setChangingPassword(true);

    try {
      const result = await changePasswordApi(
        currentPassword,
        newPassword,
        confirmNewPassword
      );

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });

      setShowPasswords(false);
      setPasswordSuccess(result.message);
    } catch (error) {
      setPasswordErrors({
        server:
          error.message || "Đổi mật khẩu thất bại. Vui lòng thử lại",
      });
    } finally {
      accountActionRef.current = false;
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page-container">
        <Navbar />
        <div
          role="status"
          style={{ padding: "60px 20px", textAlign: "center" }}
        >
          Đang tải thông tin tài khoản...
        </div>
        <Footer />
      </div>
    );
  }

  if (!user && authError) {
    return (
      <div className="profile-page-container">
        <Navbar />
        <div
          role="alert"
          style={{ padding: "60px 20px", textAlign: "center" }}
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
  const canChangePassword = user.authProvider === "local";

  const avatarInitial =
    user.fullName?.trim().charAt(0).toUpperCase() || "U";

  const displayedAvatar =
    user.avatar && failedAvatar !== user.avatar ? user.avatar : "";

  const selectedProvince = provinces.find(
    (item) => String(item.code) === userInfo.provinceCode
  );

  const selectedWard = wards.find(
    (item) => String(item.code) === userInfo.wardCode
  );

  const addressPreview = [
    userInfo.addressDetail.trim(),
    selectedWard?.name,
    selectedProvince?.name,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="profile-page-container">
      <Navbar />

      <div className="profile-header-hero">
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1,
            color: "#666",
            marginBottom: 8,
          }}
        >
          TRANG CHỦ &gt; TÀI KHOẢN &gt; THÔNG TIN CÁ NHÂN
        </div>

        <div
          style={{
            fontSize: 10,
            color: "var(--color-gold-deep)",
            fontWeight: 700,
            letterSpacing: 1.5,
            marginBottom: 4,
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
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-title)",
                fontSize: 40,
                margin: "0 0 6px",
              }}
            >
              Thông Tin Cá Nhân
            </h1>

            <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
              Thông tin tài khoản của bạn trên VESTORA.
            </p>
          </div>

          <button
            type="button"
            className="profile-edit-toggle"
            onClick={handleToggleEdit}
            disabled={accountBusy}
          >
            {isEditing ? "Đóng chỉnh sửa" : "Chỉnh sửa thông tin"}
          </button>
        </div>
      </div>

      <div className="profile-main-grid">
        <aside className="user-sidebar-card">
          <div className="profile-avatar-section">
            <div className="profile-avatar-picker">
              <div className="profile-avatar-photo">
                {displayedAvatar ? (
                  <img
                    key={displayedAvatar}
                    src={displayedAvatar}
                    alt={`Ảnh đại diện của ${profile.fullName}`}
                    onError={() => setFailedAvatar(user.avatar)}
                  />
                ) : (
                  <span className="profile-avatar-letter">
                    {avatarInitial}
                  </span>
                )}
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleChooseAvatar}
                disabled={accountBusy}
                aria-label="Chọn ảnh đại diện"
                hidden
              />

              <button
                type="button"
                className="profile-avatar-add"
                onClick={() => avatarInputRef.current?.click()}
                disabled={accountBusy}
                aria-label={
                  avatarSaving ? "Đang tải ảnh lên" : "Đổi ảnh đại diện"
                }
                title={
                  avatarSaving ? "Đang tải ảnh lên..." : "Đổi ảnh đại diện"
                }
                aria-busy={avatarSaving}
              >
                {avatarSaving ? (
                  <span
                    className="profile-avatar-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
            </div>

            {avatarError && (
              <p className="avatar-error" role="alert">
                {avatarError}
              </p>
            )}
          </div>

          <h2
            style={{
              fontFamily: "var(--font-title)",
              fontSize: 22,
              margin: "0 0 4px",
              overflowWrap: "anywhere",
            }}
          >
            {profile.fullName}
          </h2>

          <div
            style={{
              fontSize: 12,
              color: "#666",
              marginBottom: 12,
              overflowWrap: "anywhere",
            }}
          >
            {profile.email}
          </div>

          <span
            style={{
              background: "#ECFDF5",
              color: "#059669",
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: 9999,
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
                  onClick={handleOpenEdit}
                  disabled={accountBusy}
                >
                  <span className="profile-submenu-icon" aria-hidden="true">
                    ✎
                  </span>
                  <span>Chỉnh sửa thông tin</span>
                </button>

                {canChangePassword && (
                  <button
                    type="button"
                    className={`profile-submenu-button ${profileTab === "password" ? "is-active" : ""
                      }`}
                    onClick={handleOpenPassword}
                    disabled={accountBusy}
                  >
                    <span
                      className="profile-submenu-icon"
                      aria-hidden="true"
                    >
                      🔒
                    </span>
                    <span>Đổi mật khẩu</span>
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              className="profile-nav-btn"
              onClick={() => navigate("/wallet")}
              disabled={accountBusy}
            >
              <span>Ví Của Tôi</span>
              <span>›</span>
            </button>

            <button
              type="button"
              className="profile-nav-btn"
              onClick={() => navigate("/cart")}
              disabled={accountBusy}
            >
              <span>🛍️ Giỏ Hàng Của Tôi</span>
              <span>›</span>
            </button>

            <button
              type="button"
              className="profile-nav-btn"
              onClick={() => navigate("/favorites")}
              disabled={accountBusy}
            >
              <span>♡ Sản Phẩm Yêu Thích</span>
              <span>›</span>
            </button>

            <button
              type="button"
              className="profile-nav-btn"
              onClick={() => navigate("/try-on-photo")}
              disabled={accountBusy}
            >
              <span>👗 Thử Đồ Với Ảnh</span>
              <span>›</span>
            </button>

            <button
              type="button"
              className="profile-nav-btn"
              onClick={handleLogout}
              disabled={accountBusy}
              style={{
                color: "#DC2626",
                marginTop: 16,
                borderTop: "1px solid #F3F4F6",
                paddingTop: 12,
                opacity: accountBusy ? 0.6 : 1,
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
                  fontSize: 13,
                  padding: "0 12px",
                }}
              >
                {logoutError}
              </p>
            )}
          </div>
        </aside>

        <div className="profile-details-panel">
          <div className="info-card-white">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 24,
                borderBottom: "1px solid #F3F4F6",
                paddingBottom: 16,
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-title)",
                    fontSize: 20,
                    margin: 0,
                  }}
                >
                  Hồ Sơ Thành Viên
                </h3>

                <p
                  style={{
                    fontSize: 12,
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
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 9999,
                }}
              >
                {user.status === "active"
                  ? "ĐANG HOẠT ĐỘNG"
                  : "KHÔNG HOẠT ĐỘNG"}
              </span>
            </div>

            {profileTab === "password" && canChangePassword ? (
              <section
                className="profile-password-section"
                aria-labelledby="profile-password-title"
              >
                <span className="profile-password-label">
                  BẢO MẬT TÀI KHOẢN
                </span>

                <h4 id="profile-password-title">Đổi mật khẩu</h4>

                <p>
                  Nhập mật khẩu hiện tại để xác nhận và thiết lập mật khẩu mới.
                </p>

                <form
                  className="profile-change-password-form"
                  onSubmit={handleChangePassword}
                  noValidate
                >
                  {passwordErrors.server && (
                    <div
                      className="password-feedback is-error"
                      role="alert"
                    >
                      {passwordErrors.server}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div
                      className="password-feedback is-success"
                      role="status"
                    >
                      {passwordSuccess}
                    </div>
                  )}

                  {PASSWORD_FIELDS.map((field) => (
                    <div
                      className="profile-password-field"
                      key={field.name}
                    >
                      <label htmlFor={`profile-${field.name}`}>
                        {field.label}
                      </label>

                      <input
                        id={`profile-${field.name}`}
                        name={field.name}
                        type={showPasswords ? "text" : "password"}
                        autoComplete={field.autoComplete}
                        placeholder={field.placeholder}
                        value={passwordForm[field.name]}
                        onChange={handlePasswordChange}
                        disabled={accountBusy}
                        aria-invalid={Boolean(passwordErrors[field.name])}
                        aria-describedby={
                          passwordErrors[field.name]
                            ? `profile-${field.name}-error`
                            : undefined
                        }
                      />

                      {passwordErrors[field.name] && (
                        <span
                          id={`profile-${field.name}-error`}
                          className="profile-password-error"
                          role="alert"
                        >
                          {passwordErrors[field.name]}
                        </span>
                      )}
                    </div>
                  ))}

                  <label className="profile-password-visibility">
                    <input
                      type="checkbox"
                      checked={showPasswords}
                      onChange={(event) =>
                        setShowPasswords(event.target.checked)
                      }
                      disabled={accountBusy}
                    />
                    Hiện mật khẩu
                  </label>

                  <div className="profile-password-actions">
                    <button
                      type="submit"
                      className="profile-password-submit"
                      disabled={accountBusy}
                    >
                      {changingPassword ? "Đang lưu..." : "Lưu mật khẩu mới"}
                    </button>
                  </div>
                </form>
              </section>
            ) : !isEditing ? (
              <div>
                {notice && (
                  <div
                    className="profile-edit-notice"
                    role="status"
                    style={{ marginBottom: 16 }}
                  >
                    {notice}
                  </div>
                )}

                {[
                  ["Họ và tên", profile.fullName],
                  ["Địa chỉ email", profile.email],
                  ["Số điện thoại liên lạc", profile.phone || "Chưa cập nhật"],
                  ["Địa chỉ liên hệ", profile.address || "Chưa cập nhật"],
                  ["Vai trò tài khoản", roleLabel],
                ].map(([label, value]) => (
                  <div className="profile-table-row" key={label}>
                    <span style={{ color: "#666" }}>{label}</span>
                    <strong style={{ overflowWrap: "anywhere" }}>
                      {value}
                    </strong>
                    <span />
                  </div>
                ))}
              </div>
            ) : (
              <form
                onSubmit={handleSave}
                className="vestora-profile-form"
                noValidate
              >
                <div className="profile-edit-intro">
                  <span className="profile-edit-eyebrow">
                    THÔNG TIN CÁ NHÂN
                  </span>
                  <h4>Chỉnh sửa hồ sơ</h4>
                  <p>Cập nhật thông tin liên hệ của bạn trên VESTORA.</p>
                </div>

                <fieldset
                  disabled={accountBusy}
                  style={{
                    border: 0,
                    padding: 0,
                    margin: 0,
                    minWidth: 0,
                  }}
                >
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
                      />

                      <small>Họ tên tối đa 25 ký tự.</small>
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
                        type="email"
                        autoComplete="email"
                        value={userInfo.email}
                        readOnly
                      />

                      <small>Email đang dùng để đăng nhập tài khoản.</small>
                    </div>

                    <div className="profile-field profile-field-full">
                      <div className="profile-field-heading">
                        <label htmlFor="profile-phone">Số điện thoại</label>
                      </div>

                      <input
                        id="profile-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="Ví dụ: 0912345678"
                        value={userInfo.phone}
                        onChange={handleChange}
                        maxLength={20}
                        required
                      />
                    </div>

                    <div className="profile-field">
                      <div className="profile-field-heading">
                        <label htmlFor="profile-province">
                          Tỉnh/Thành phố
                        </label>
                      </div>

                      <select
                        id="profile-province"
                        name="provinceCode"
                        value={userInfo.provinceCode}
                        onChange={handleChange}
                        disabled={loadingProvinces}
                        style={SELECT_STYLE}
                        required
                      >
                        <option value="">
                          {loadingProvinces
                            ? "Đang tải danh sách..."
                            : "Chọn Tỉnh/Thành phố"}
                        </option>

                        {provinces.map((province) => (
                          <option
                            key={province.code}
                            value={String(province.code)}
                          >
                            {province.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="profile-field">
                      <div className="profile-field-heading">
                        <label htmlFor="profile-ward">Phường/Xã</label>
                      </div>

                      <select
                        id="profile-ward"
                        name="wardCode"
                        value={userInfo.wardCode}
                        onChange={handleChange}
                        disabled={!userInfo.provinceCode || loadingWards}
                        style={SELECT_STYLE}
                        required
                      >
                        <option value="">
                          {loadingWards
                            ? "Đang tải danh sách..."
                            : !userInfo.provinceCode
                              ? "Chọn tỉnh/thành phố trước"
                              : "Chọn Phường/Xã"}
                        </option>

                        {wards.map((ward) => (
                          <option
                            key={ward.code}
                            value={String(ward.code)}
                          >
                            {ward.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="profile-field profile-field-full">
                      <div className="profile-field-heading">
                        <label htmlFor="profile-address-detail">
                          Địa chỉ chi tiết
                        </label>
                        <span className="profile-field-counter">
                          {[...userInfo.addressDetail].length}/200
                        </span>
                      </div>

                      <textarea
                        id="profile-address-detail"
                        name="addressDetail"
                        autoComplete="street-address"
                        placeholder="Số nhà, tên đường, ngõ, thôn..."
                        rows={3}
                        maxLength={200}
                        value={userInfo.addressDetail}
                        onChange={handleChange}
                        required
                      />

                      {!profile.provinceCode && profile.address && (
                        <small>
                          Địa chỉ cũ: {profile.address}. Vui lòng chọn
                          tỉnh/xã và nhập lại phần số nhà, đường, thôn.
                        </small>
                      )}
                    </div>
                  </div>

                  {(provinceError || wardError) && (
                    <div style={ERROR_STYLE} role="alert">
                      <p style={{ margin: "0 0 8px" }}>
                        {provinceError || wardError}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          setAddressRetry((previous) => previous + 1)
                        }
                        style={{
                          border: 0,
                          padding: 0,
                          background: "transparent",
                          color: "inherit",
                          textDecoration: "underline",
                          cursor: "pointer",
                        }}
                      >
                        Tải lại danh mục
                      </button>
                    </div>
                  )}

                  {addressPreview && (
                    <div
                      style={{
                        marginTop: 20,
                        padding: "14px 16px",
                        border: "1px solid #e9dfcf",
                        borderRadius: 10,
                        background: "#f7f3ec",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 1,
                          color: "#96723d",
                        }}
                      >
                        ĐỊA CHỈ ĐẦY ĐỦ
                      </span>

                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "#51483d",
                          fontSize: 14,
                          lineHeight: 1.6,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {addressPreview}
                      </p>
                    </div>
                  )}

                  {profileError && (
                    <div style={ERROR_STYLE} role="alert">
                      {profileError}
                    </div>
                  )}

                  <div className="profile-edit-actions">
                    <p>Kiểm tra thông tin trước khi lưu.</p>

                    <div className="profile-edit-buttons">
                      <button
                        type="button"
                        className="profile-cancel-button"
                        onClick={handleCancelEdit}
                      >
                        Hủy bỏ
                      </button>

                      <button
                        type="submit"
                        className="profile-save-button"
                        disabled={
                          accountBusy ||
                          loadingProvinces ||
                          loadingWards ||
                          Boolean(provinceError || wardError)
                        }
                      >
                        {profileSaving ? "Đang lưu..." : "Lưu thay đổi"}
                      </button>
                    </div>
                  </div>
                </fieldset>
              </form>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}