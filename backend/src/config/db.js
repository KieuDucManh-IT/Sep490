import dns from "node:dns";
import mongoose from "mongoose";

// Thiết lập DNS dự phòng (Google/Cloudflare) khắc phục lỗi querySrv ECONNREFUSED trên Windows với MongoDB Atlas
try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch {
  // Bỏ qua nếu runtime không cho phép cấu hình DNS
}

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured in .env");
  }

  const connection = await mongoose.connect(mongoUri);
  console.log(`[VESTORA DB] MongoDB connected: ${connection.connection.host} / DB: ${connection.connection.name}`);
  return connection;
};

export { mongoose };
export default connectDB;
