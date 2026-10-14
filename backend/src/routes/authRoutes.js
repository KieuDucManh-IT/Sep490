import express from "express";

import {
  register,
  verifyRegisterOtp,
  login,
  getMe,
  logout,
} from "../controllers/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authRequestMiddleware from "../middleware/authRequestMiddleware.js";

const router = express.Router();

// Đăng ký: giữ OTP.
router.post("/register", register);

router.post(
  "/register/verify-otp",
  verifyRegisterOtp
);

// Login: chỉ email + mật khẩu.
router.post(
  "/login",
  authRequestMiddleware,
  login
);

// Lấy tài khoản khi reload trang.
router.get(
  "/me",
  authMiddleware,
  getMe
);

// Đăng xuất trên trình duyệt hiện tại.
router.post(
  "/logout",
  authRequestMiddleware,
  logout
);

export default router;