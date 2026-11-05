import express from "express";

import {
  register,
  verifyRegisterOtp,
  login,
  loginGoogle,
  getMe,
  logout,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  changePassword,
  updateAvatar,
  updateProfile,
} from "../controllers/system/authController.js";

import multer from "multer";

import { authMiddleware } from "../middlewares/errorMiddleware.js";

import authRequestMiddleware from "../middlewares/authRequestMiddleware.js";

const router = express.Router();

// Đăng ký tài khoản.
router.post("/register", register);

// Xác thực OTP đăng ký.
router.post("/register/verify-otp", verifyRegisterOtp);

// Đăng nhập bằng email và mật khẩu.
router.post("/login", authRequestMiddleware, login);

// Đăng nhập bằng Google.
router.post("/google", authRequestMiddleware, loginGoogle);

// Lấy tài khoản khi reload trang.
router.get("/me", authMiddleware, getMe);

// Đăng xuất trên trình duyệt hiện tại.
router.post("/logout", authRequestMiddleware, logout);

router.post(
  "/forgot-password",
  authRequestMiddleware,
  forgotPassword
);

router.post(
  "/forgot-password/verify-otp",
  authRequestMiddleware,
  verifyForgotPasswordOtp
);

router.post(
  "/reset-password",
  authRequestMiddleware,
  resetPassword
);

router.post(
  "/change-password",
  authRequestMiddleware,
  authMiddleware,
  changePassword
);

const avatarUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
  },

  fileFilter(req, file, callback) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        Object.assign(
          new Error("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"),
          { status: 400 }
        )
      );
    }

    callback(null, true);
  },
});

function avatarRequestMiddleware(req, res, next) {
  const allowedOrigin =
    process.env.FRONTEND_URL || "http://localhost:3000";

  if (req.get("Origin") !== allowedOrigin) {
    return res.status(403).json({
      message: "Nguồn yêu cầu không được phép",
    });
  }

  if (!req.is("multipart/form-data")) {
    return res.status(415).json({
      message: "Upload ảnh phải sử dụng multipart/form-data",
    });
  }

  next();
}

router.patch(
  "/avatar",
  avatarRequestMiddleware,
  authMiddleware,
  avatarUpload.single("avatar"),
  updateAvatar
);

router.patch(
  "/profile",
  authRequestMiddleware,
  authMiddleware,
  updateProfile
);

export default router;
