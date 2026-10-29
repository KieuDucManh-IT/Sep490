import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute - Enforce authentication and role-based access control (RBAC)
 * @param {React.ReactNode} children - Component to render if authorized
 * @param {Array<string>} allowedRoles - Optional list of authorized roles (e.g. ['SHOP_OWNER', 'OWNER'])
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation();

  const {
    user,
    loading,
    authError,
    refreshUser,
  } = useAuth();

  if (loading) {
    return <p style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Đang kiểm tra quyền truy cập...</p>;
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

  if (allowedRoles && allowedRoles.length > 0) {
    const rawRole = String(user.Role || user.role || "").trim().toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => String(r).trim().toUpperCase());
    const hasPermission = rawRole === "ADMIN" || normalizedAllowed.includes(rawRole);

    if (!hasPermission) {
      if (rawRole === "BRANCH_MANAGER") {
        return <Navigate to="/branch/dashboard" replace />;
      }
      if (rawRole === "WAREHOUSE_MANAGER" || rawRole === "WAREHOUSE_STAFF") {
        return <Navigate to="/warehousemanager" replace />;
      }
      if (rawRole === "SHOP_OWNER" || rawRole === "OWNER") {
        return <Navigate to="/owner/branches" replace />;
      }
      if (rawRole === "OPERATION_STAFF" || rawRole === "OPS") {
        return <Navigate to="/ops/shops" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return children;
}