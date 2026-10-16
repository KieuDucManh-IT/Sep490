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
} from "../controllers/authController.js";

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

export default router;