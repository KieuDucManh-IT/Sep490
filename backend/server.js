import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

import { connectDB } from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import shopRoutes from "./src/routes/shopRoutes.js";
import apiRoutes from "./src/routes/apiRoutes.js";
import User from "./src/models/system/User.js";
import { notFound, errorHandler } from "./src/middlewares/errorMiddleware.js";
import walletRoutes, {
  asyncRoute,
} from "./src/routes/walletRoutes.js";

import {
  payosWebhook,
} from "./src/controllers/walletController.js";

import { Wallet } from "./src/models/finance/Wallet.js";
import {
  WalletTransaction,
} from "./src/models/finance/WalletTransaction.js";

import {
  checkWalletKeys,
} from "./src/utils/walletSecurity.js";

import {
  startWalletReconcileJob,
} from "./src/jobs/walletReconcileJob.js";

dotenv.config();

const app = express();

const allowedOrigins = (
  process.env.CLIENT_URL ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.post(
  "/api/webhooks/payos",
  asyncRoute(payosWebhook)
);

app.use("/api/wallet", walletRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/admin/shops", shopRoutes);
app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    await connectDB();
    await User.init();
    checkWalletKeys();

    const hello = await mongoose.connection.db
      .admin()
      .command({ hello: 1 });

    if (!hello.setName && hello.msg !== "isdbgrid") {
      throw new Error("Chức năng Ví cần MongoDB replica set hoặc Atlas");
    }

    // Chặn việc vô tình dùng schema mới trên dữ liệu Ví cũ.
    const oldWallet = await Wallet.collection.findOne({
      $or: [
        { balance: { $exists: true } },
        { lockedBalance: { $exists: true } },
        { balanceEncrypted: { $exists: false } },
      ],
    });

    const oldTransaction = await WalletTransaction.collection.findOne({
      $or: [
        { balanceBefore: { $exists: true } },
        { balanceAfter: { $exists: true } },
        { userId: { $exists: false } },
        { code: { $exists: false } },
      ],
    });

    if (oldWallet || oldTransaction) {
      throw new Error(
        "Có dữ liệu Ví cũ cần chuyển đổi sang schema mã hóa trước khi chạy"
      );
    }

    await Wallet.init();
    await WalletTransaction.init();

    startWalletReconcileJob();

    console.log("Đã kết nối database:", mongoose.connection.name);
    console.log("Collection tài khoản:", User.collection.name);

    app.listen(PORT, () => {
      console.log(`Backend đang chạy tại http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Lỗi khởi động backend:", error.message);
    process.exit(1);
  }
}

startServer();

export default app;
