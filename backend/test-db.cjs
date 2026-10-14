require("dotenv").config({
  path: require("path").join(__dirname, ".env")
});

const mongoose = require("mongoose");

async function testConnection() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("Chưa có MONGODB_URI trong file .env");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    await mongoose.connection.db.command({ ping: 1 });

    console.log("✅ Kết nối MongoDB thành công!");
    console.log("Database:", mongoose.connection.name);
  } catch (error) {
    console.error("❌ Kết nối thất bại:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

testConnection();