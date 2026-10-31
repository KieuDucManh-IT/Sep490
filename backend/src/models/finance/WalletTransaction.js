import mongoose from "mongoose";

export const WALLET_TYPES = [
  "top_up",
  "withdraw",
  "payment",
  "rental_payment",
  "rental_deposit",
  "refund",
  "deposit_refund",
  "adjustment",
  "reversal",
];

export const WALLET_STATUSES = [
  "otp_pending",
  "pending",
  "queued",
  "submitting",
  "processing",
  "review",
  "success",
  "failed",
  "expired",
  "reversed",
];

const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
    },

    transactionType: {
      type: String,
      required: true,
      enum: WALLET_TYPES,
    },

    direction: {
      type: String,
      required: true,
      enum: ["credit", "debit"],
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },

    status: {
      type: String,
      enum: WALLET_STATUSES,
      default: "pending",
      index: true,
    },

    // Chống ghi lặp nghiệp vụ mua hàng/hoàn tiền khi tích hợp sau.
    businessKey: String,

    referenceType: String,

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    orderCode: Number,
    paymentLinkId: String,
    checkoutUrl: String,
    qrCode: String,

    payoutId: String,
    submittedAt: Date,
    providerState: String,

    withdrawDeadlineAt: Date,

    // Chỉ được đặt true khi xác nhận việc tạo lệnh bị từ chối.
    createRejected: {
      type: Boolean,
      default: false,
    },

    lastSyncError: String,

    bankBin: String,
    bankLast4: String,

    bankEncrypted: {
      type: String,
      select: false,
    },

    otpHash: {
      type: String,
      select: false,
    },

    otpEmail: {
      type: String,
      select: false,
    },

    otpExpiresAt: Date,

    otpAttempts: {
      type: Number,
      default: 0,
    },

    fundsReserved: {
      type: Boolean,
      default: false,
    },

    // Không lưu balanceBefore/balanceAfter dạng số thường.
    reserveSnapshotEncrypted: {
      type: String,
      select: false,
    },

    settleSnapshotEncrypted: {
      type: String,
      select: false,
    },

    nextCheckAt: {
      type: Date,
      default: () => new Date(Date.now() + 60000),
    },

    nextUserSyncAt: {
      type: Date,
      default: () => new Date(0),
    },

    completedAt: Date,
  },
  { timestamps: true }
);

walletTransactionSchema.index(
  { orderCode: 1 },
  { unique: true, sparse: true }
);

walletTransactionSchema.index(
  { businessKey: 1 },
  { unique: true, sparse: true }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ status: 1, nextCheckAt: 1 });
walletTransactionSchema.index({
  status: 1,
  withdrawDeadlineAt: 1,
});

export const WalletTransaction =
  mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", walletTransactionSchema);