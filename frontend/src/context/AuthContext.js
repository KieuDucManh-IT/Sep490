import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  loginApi,
  loginGoogleApi,
  getMeApi,
  logoutApi,
  updateAvatarApi,
  updateProfileApi,
} from "../services/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Khôi phục tài khoản từ cookie.
  const refreshUser = useCallback(async () => {
    try {
      const data = await getMeApi();

      setUser(data.user);
      setAuthError("");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUser(null);
        setAuthError("");
      } else {
        setAuthError(
          error.message || "Không thể kết nối đến server"
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Đăng nhập bằng email và mật khẩu.
  const login = async (email, password) => {
    const data = await loginApi(email, password);

    setUser(data.user);
    setAuthError("");

    return data.user;
  };

  // Đăng nhập bằng Google.
  const loginGoogle = async (credential) => {
    if (!credential) {
      throw new Error(
        "Không nhận được thông tin đăng nhập từ Google"
      );
    }

    const data = await loginGoogleApi(credential);

    setUser(data.user);
    setAuthError("");

    return data.user;
  };

  // Cập nhật ảnh đại diện.
  const updateAvatar = async (file) => {
    if (!file) {
      throw new Error("Vui lòng chọn ảnh đại diện");
    }

    const data = await updateAvatarApi(file);

    setUser(data.user);
    setAuthError("");

    return data;
  };

  // Cập nhật họ tên, số điện thoại và địa chỉ.
  // Hàm này phải nằm BÊN TRONG AuthProvider.
  const updateProfile = async (payload) => {
    const data = await updateProfileApi(payload);

    setUser(data.user);
    setAuthError("");

    // UserProfilePage cần cả data.user và data.message.
    return data;
  };

  // Đăng xuất.
  const logout = async () => {
    await logoutApi();

    setUser(null);
    setAuthError("");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        login,
        loginGoogle,
        logout,
        refreshUser,
        updateAvatar,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth phải được sử dụng bên trong AuthProvider"
    );
  }

  return context;
}