import jwt from "jsonwebtoken";
import User from "../models/system/User.js";

export async function authMiddleware(req, res, next) {
  const authHeader = req.get?.('Authorization') || req.headers?.authorization || '';
  const token = (typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : null) || req.cookies?.vestora_token || null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Bạn chưa đăng nhập",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Server chưa cấu hình JWT_SECRET",
    });
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "vestora",
      audience: "vestora-web",
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Thông tin đăng nhập không hợp lệ hoặc đã hết hạn",
    });
  }

  if (
    typeof payload.sub !== "string" ||
    !/^[a-f0-9]{24}$/i.test(payload.sub)
  ) {
    return res.status(401).json({
      success: false,
      message: "Thông tin đăng nhập không hợp lệ",
    });
  }

  try {
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không còn tồn tại",
      });
    }

    if (user.Status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị vô hiệu hóa",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
}

const normalizeRole = (r) => String(r || '').trim().toLowerCase().replace(/[\s_-]/g, '').replace('brandmanager', 'branchmanager');

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Bạn chưa đăng nhập" });
    }
    const userRole = normalizeRole(req.user.Role || req.user.role);
    const normalizedAllowed = allowedRoles.map(normalizeRole);
    if (userRole !== "admin" && !normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện thao tác này.",
      });
    }
    return next();
  };
}

export const requireRoles = requireRole;

export function requireShopOwnerOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Bạn chưa đăng nhập" });
  }
  const userRole = normalizeRole(req.user.Role || req.user.role);
  if (!["shopowner", "owner", "admin"].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: "Chỉ Shop Owner mới có quyền cấu hình bảng giá và tiền cọc.",
    });
  }
  return next();
}

export function notFound(req, res) {
  return res.status(404).json({
    message: "API không tồn tại",
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === "MulterError") {
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Ảnh đại diện không được vượt quá 5 MB"
          : "Dữ liệu tải ảnh không hợp lệ",
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      message: "Thông tin tài khoản đã tồn tại",
    });
  }

  if (error.name === "ValidationError") {
    const errorList = Object.values(error.errors || {}).map((item) => item.message).filter(Boolean);
    const message = errorList.length > 0 ? errorList.join("; ") : "Dữ liệu không hợp lệ";
    return res.status(400).json({
      success: false,
      message,
      errors: Object.values(error.errors || {}).map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Dữ liệu JSON không hợp lệ",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "Dữ liệu gửi lên quá lớn",
    });
  }

  const status =
    Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status <= 599
      ? error.status
      : 500;

  // CHỈ log stack trace khi là lỗi máy chủ thực sự (status >= 500)
  // Các lỗi 4xx client thông thường (400, 401, 403, 404) không in stack trace gây rác log
  if (status >= 500) {
    console.error(
      `[LỖI SERVER ${status}] ${req.method} ${req.originalUrl || req.path}:`,
      error.stack || error.message
    );
  }

  return res.status(status).json({
    success: false,
    message: error.status === status
      ? error.message
      : "Có lỗi phía server. Vui lòng thử lại",
  });
}
