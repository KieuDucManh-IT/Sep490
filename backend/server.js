import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/authRoutes.js";
import {
  notFound,
  errorHandler,
} from "./src/middlewares/errorMiddleware.js";
const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("Thiếu JWT_SECRET trong backend/.env");
    }

    await connectDB();

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(
        `Backend đang chạy tại http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error(
      "Lỗi khởi động backend:",
      error.message
    );

    process.exit(1);
  }
}

startServer();