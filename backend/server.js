import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./src/config/db.js";
import apiRoutes from "./src/routes/apiRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Main API Route
app.use("/api", apiRoutes);

// Connect DB & Start Server
connectDB();

app.listen(PORT, () => {
  console.log(` [VESTORA MONOLITH BACKEND] Running at http://localhost:${PORT}`);
});
