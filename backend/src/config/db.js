import mongoose from "mongoose";

export default async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Thiếu MONGODB_URI trong backend/.env");
  }

  const connection = await mongoose.connect(
    process.env.MONGODB_URI
  );

  console.log(
    "Đã kết nối MongoDB:",
    connection.connection.name
  );

  return connection;
}