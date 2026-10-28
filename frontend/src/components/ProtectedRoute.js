import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();

  const {
    user,
    loading,
    authError,
    refreshUser,
  } = useAuth();

  if (loading) {
    return <p>Đang kiểm tra đăng nhập...</p>;
  }

  if (!user && authError) {
    return (
      <div style={{ padding: 24 }} role="alert">
        <p>{authError}</p>

        <button type="button" onClick={refreshUser}>
          Thử lại
        </button>
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

  const userRole = (user.role || user.Role || '').toUpperCase();
  if (allowedRoles?.length && !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
