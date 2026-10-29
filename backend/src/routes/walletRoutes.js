import express from "express";
import rateLimit from "express-rate-limit";

import { authMiddleware } from "../middlewares/errorMiddleware.js";
import * as controller from "../controllers/walletController.js";

const router = express.Router();

export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

router.use(authMiddleware);

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");

  if (["GET", "HEAD"].includes(req.method)) {
    return next();
  }

  // Cookie đăng nhập cần được bảo vệ với yêu cầu thay đổi dữ liệu.
  const allowedOrigins = (
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000"
  )
    .split(",")
    .map((value) => value.trim());

  if (!allowedOrigins.includes(req.get("Origin"))) {
    return res.status(403).json({
      message: "Nguồn yêu cầu không được phép",
    });
  }

  if (!req.is("application/json")) {
    return res.status(415).json({
      message: "Request phải sử dụng application/json",
    });
  }

  next();
});

router.use(
  rateLimit({
    windowMs: 60000,
    limit: 60,
    keyGenerator: (req) => String(req.user._id),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau",
    },
  })
);

router.get("/", asyncRoute(controller.getWallet));

router.post(
  "/password/send-otp",
  asyncRoute(controller.sendSetupOtp)
);

router.post(
  "/password/setup",
  asyncRoute(controller.setupPassword)
);

router.get(
  "/transactions",
  asyncRoute(controller.getTransactions)
);

router.post(
  "/top-ups",
  asyncRoute(controller.createTopup)
);

router.post(
  "/top-ups/:orderCode/sync",
  asyncRoute(controller.syncReturnedTopup)
);

router.post(
  "/withdrawals/send-otp",
  asyncRoute(controller.sendWithdrawOtp)
);

router.post(
  "/withdrawals/confirm",
  asyncRoute(controller.confirmWithdraw)
);

router.post(
  "/transactions/:id/sync",
  asyncRoute(controller.syncTransaction)
);

export default router;