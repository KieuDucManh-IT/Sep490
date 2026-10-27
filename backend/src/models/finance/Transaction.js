import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  transactionCode: { type: String, required: true, unique: true, trim: true },
  transactionType: { type: String, required: true, enum: ['sale_payment', 'rental_fee', 'deposit', 'late_fee', 'damage_fee', 'refund', 'wallet_top_up', 'wallet_payment', 'adjustment'] },
  referenceType: { type: String, enum: ['sales_order', 'rental_order', 'sales_return', 'rental_return', 'payment', 'refund', 'wallet'], default: null },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  amount: { type: Number, required: true, min: 0 },
  direction: { type: String, required: true, enum: ['in', 'out'] },
  status: { type: String, default: 'pending', enum: ['pending', 'success', 'failed', 'cancelled', 'reversed'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
