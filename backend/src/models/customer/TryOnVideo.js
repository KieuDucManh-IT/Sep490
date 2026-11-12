import mongoose from "mongoose";

const tryOnVideoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    recordingId: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    bytes: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// Một bản ghi không được tạo nhiều lần khi người dùng bấm lưu lại.
tryOnVideoSchema.index(
  { userId: 1, recordingId: 1 },
  { unique: true }
);

tryOnVideoSchema.index({
  userId: 1,
  productId: 1,
  createdAt: -1,
});

export default mongoose.models.TryOnVideo ||
  mongoose.model("TryOnVideo", tryOnVideoSchema);