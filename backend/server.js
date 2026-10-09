import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db.js";
import productRoutes from "./src/routes/productRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(express.json());

// Domain API Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ONLINE",
    architecture: "Monolithic Modular Domain Structure",
    escrow: "PayOS Integrated"
  });
});

// Connect DB & Start Server
connectDB();

app.listen(PORT, () => {
  console.log(`✅ [VESTORA MONOLITH BACKEND] Running at http://localhost:${PORT}`);
});
