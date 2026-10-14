import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  loginApi,
  getMeApi,
  logoutApi,
} from "../services/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

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
        // Lỗi mạng không xóa cookie đăng nhập.
        setAuthError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Khi mở hoặc reload ứng dụng, lấy lại tài khoản từ cookie.
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const data = await loginApi(email, password);

    setUser(data.user);
    setAuthError("");

    return data.user;
  };

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
        logout,
        refreshUser,
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