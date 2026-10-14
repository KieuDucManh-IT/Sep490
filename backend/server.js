import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db.js";
import productRoutes from "./src/routes/productRoutes.js";
import orderRoutes from "./src/routes/orderRoutes.js";
import shopRoutes from "./src/routes/shopRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/admin/shops", shopRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ONLINE",
    architecture: "Monolithic Modular Domain Structure",
    escrow: "PayOS Integrated"
  });
});

connectDB();

app.listen(PORT, () => {
  console.log(`✅ [VESTORA MONOLITH BACKEND] Running at http://localhost:${PORT}`);
});
