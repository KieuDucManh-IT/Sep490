import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
  transactionType: { type: String, required: true, enum: ['top_up', 'payment', 'refund', 'adjustment', 'reversal'] },
  amount: { type: Number, required: true, min: 0 },
  direction: { type: String, required: true, enum: ['credit', 'debit'] },
  balanceBefore: { type: Number, required: true, min: 0 },
  balanceAfter: { type: Number, required: true, min: 0 },
  referenceType: { type: String, enum: ['sales_order', 'rental_order', 'payment', 'refund', 'wallet_transaction'], default: null },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  status: { type: String, default: 'pending', enum: ['pending', 'success', 'failed', 'reversed'] },
}, { timestamps: true });

export const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', walletTransactionSchema);
