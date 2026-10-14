import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db.js";
import productRoutes from "./src/routes/productRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import shopRoutes from "./src/routes/shopRoutes.js";

const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./src/routes/authRoutes");
const User = require("./src/models/User");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/admin/shops", shopRoutes);
const allowedOrigins = (
  process.env.CLIENT_URL || "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
  }),
);

app.use(express.json());

app.use("/api/auth", authRoutes);

app.use((error, req, res, next) => {
  console.error("Lỗi API:", error.name, error.code || "");

  res.status(error.status || 500).json({
    message: error.status
      ? error.message
      : "Có lỗi phía server. Vui lòng thử lại",
  });
});

connectDB();
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Đợi tạo index để kiểm tra email trùng.
    await User.init();

    console.log("Đã kết nối database:", mongoose.connection.name);
    console.log("Collection tài khoản:", User.collection.name);

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(`Backend đang chạy tại http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Lỗi khởi động backend:", error.message);
    process.exit(1);
  }
}

startServer();
