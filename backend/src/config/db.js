import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vestora';
  try {
    const conn = await mongoose.connect(uri);
    console.log(`🍃 [VESTORA DB] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`⚠️ [VESTORA DB] MongoDB Connection Warning: ${error.message}`);
    console.log(`💡 Running backend in API Mock & In-Memory Mode.`);
  }
};

export default connectDB;

