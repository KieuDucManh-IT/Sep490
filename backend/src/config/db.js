import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error("Chưa cấu hình MONGODB_URI");
  }

  await mongoose.connect(uri);

  console.log("Đã kết nối MongoDB");
}

export default connectDB;