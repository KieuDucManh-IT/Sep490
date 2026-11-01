import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import shopRoutes from "./src/routes/shopRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import apiRoutes from "./src/routes/apiRoutes.js";
import productRoutes from "./src/routes/productRoutes.js";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5001",
  "http://127.0.0.1:5001",
];

const envOrigins = [
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : []),
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
].map((o) => o.trim()).filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.post(
  "/api/webhooks/payos",
  asyncRoute(payosWebhook)
);

app.use("/api/wallet", walletRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/admin/shops", shopRoutes);
app.use("/api/ops/shops", shopRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
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
