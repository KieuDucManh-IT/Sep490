import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI chưa được cấu hình trong .env");
  }

  const conn = await mongoose.connect(mongoUri);
  console.log(`[VESTORA DB] MongoDB Atlas Connected: ${conn.connection.host} / DB: ${conn.connection.name}`);
  return conn;
};

export default connectDB;
