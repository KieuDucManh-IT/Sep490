import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function authMiddleware(req, res, next) {
  const token = req.cookies?.vestora_token;

  if (!token) {
    return next(
      Object.assign(new Error("Bạn chưa đăng nhập"), {
        status: 401,
      })
    );
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error("Server chưa cấu hình JWT_SECRET"));
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "vestora",
      audience: "vestora-web",
    });
  } catch {
    return next(
      Object.assign(
        new Error("Thông tin đăng nhập không hợp lệ"),
        { status: 401 }
      )
    );
  }

  if (
    typeof payload.sub !== "string" ||
    !/^[a-f0-9]{24}$/i.test(payload.sub)
  ) {
    return next(
      Object.assign(
        new Error("Thông tin đăng nhập không hợp lệ"),
        { status: 401 }
      )
    );
  }

  try {
    const user = await User.findById(payload.sub);

    if (!user) {
      return next(
        Object.assign(new Error("Tài khoản không còn tồn tại"), {
          status: 401,
        })
      );
    }

    if (user.Status !== "active") {
      return next(
        Object.assign(new Error("Tài khoản đã bị vô hiệu hóa"), {
          status: 403,
        })
      );
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
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
    return res.status(400).json({
      message: "Thông tin tài khoản không hợp lệ",
      errors: Object.values(error.errors).map((item) => ({
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

  console.error(
    `Lỗi API ${req.method} ${req.path}:`,
    error.stack || error.message
  );

  return res.status(status).json({
    message: error.status === status
      ? error.message
      : "Có lỗi phía server. Vui lòng thử lại",
  });
}