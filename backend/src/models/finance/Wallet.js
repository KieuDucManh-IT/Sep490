import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    balanceEncrypted: {
      type: String,
      required: true,
      select: false,
    },

    lockedBalanceEncrypted: {
      type: String,
      required: true,
      select: false,
    },

    passwordHash: {
      type: String,
      default: null,
      select: false,
    },

    passwordFailures: {
      type: Number,
      default: 0,
    },

    passwordLockedUntil: {
      type: Date,
      default: () => new Date(0),
    },

    nextPasswordAt: {
      type: Date,
      default: () => new Date(0),
    },

    // OTP dùng khi thiết lập mật khẩu Ví.
    otpHash: {
      type: String,
      select: false,
    },

    otpExpiresAt: Date,

    otpAttempts: {
      type: Number,
      default: 0,
    },

    nextOtpAt: {
      type: Date,
      default: () => new Date(0),
    },

    currency: {
      type: String,
      default: "VND",
      enum: ["VND"],
    },

    status: {
      type: String,
      default: "active",
      enum: ["active", "locked", "closed"],
    },
  },
  { timestamps: true }
);

export const Wallet =
  mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);