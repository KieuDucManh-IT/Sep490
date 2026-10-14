import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "node:http";

import connectDB from "./src/config/db.js";
import User from "./src/models/User.js";
import authRoutes from "./src/routes/authRoutes.js";

import {
  notFound,
  errorHandler,
} from "./src/middleware/errorMiddleware.js";

import {
  verifyEmailConnection,
} from "./src/utils/sendEmail.js";

const app = express();
const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT || 5000);

const CLIENT_URL =
  process.env.CLIENT_URL || "http://localhost:3000";

// Cho phép frontend gửi và nhận cookie đăng nhập.
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

// Đọc JSON từ frontend.
app.use(express.json({ limit: "20kb" }));

// Đọc cookie và đưa vào req.cookies.
// Phải đặt trước các routes.
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    message: "VESTORA API đang hoạt động",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "backend",
    timestamp: new Date().toISOString(),
  });
});

// Đăng ký, đăng nhập, lấy tài khoản, đăng xuất.
app.use("/api/auth", authRoutes);

// Sau tất cả routes.
app.use(notFound);
app.use(errorHandler);

httpServer.on("error", (error) => {
  console.error(
    "Lỗi HTTP server:",
    error.code === "EADDRINUSE"
      ? `Cổng ${PORT} đang được sử dụng`
      : error.message
  );

  process.exit(1);
});

async function startServer() {
  try {
    if (!process.env.JWT_SECRET?.trim()) {
      throw new Error("Thiếu JWT_SECRET trong backend/.env");
    }

    await connectDB();
    await User.init();
    await verifyEmailConnection();

    console.log(
      "Collection tài khoản:",
      User.collection.name
    );

    httpServer.listen(PORT, () => {
      console.log(
        `Backend đang chạy tại http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Không thể khởi động backend:", {
      name: error.name,
      code: error.code,
      message: error.message,
    });

    process.exit(1);
  }
}

startServer();