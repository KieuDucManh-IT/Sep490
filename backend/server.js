import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { connectDB } from "./src/config/db.js";
import shopRoutes from "./src/routes/shopRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import User from "./src/models/User.js";
import apiRoutes from "./src/routes/apiRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = (
  process.env.CLIENT_URL ||
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use("/api/auth", authRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/admin/shops", shopRoutes);
app.use("/api", apiRoutes);

app.use((error, req, res, next) => {
  console.error("Lỗi API:", error.name, error.code || "");

  res.status(error.status || 500).json({
    message: error.status
      ? error.message
      : "Có lỗi phía server. Vui lòng thử lại",
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    await User.init();

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
