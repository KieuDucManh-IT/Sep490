import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured in .env");
  }

  const connection = await mongoose.connect(mongoUri);
  console.log(`[VESTORA DB] MongoDB connected: ${connection.connection.host} / DB: ${connection.connection.name}`);
  return connection;
};

export default connectDB;