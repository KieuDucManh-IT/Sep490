import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  refundCode: { type: String, required: true, unique: true, trim: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  refundType: { type: String, required: true, enum: ['sales_return', 'rental_deposit', 'other'] },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, trim: true },
  refundStatus: { type: String, default: 'pending', enum: ['pending', 'success', 'failed', 'cancelled'] },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

export const Refund = mongoose.models.Refund || mongoose.model('Refund', refundSchema);
