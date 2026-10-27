import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  paymentCode: { type: String, required: true, unique: true, trim: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  paymentMethod: { type: String, required: true, enum: ['cash', 'bank_transfer', 'card', 'payment_gateway', 'wallet'] },
  amount: { type: Number, required: true, min: 0 },
  paymentStatus: { type: String, default: 'pending', enum: ['pending', 'success', 'failed', 'cancelled'] },
  providerReference: { type: String, trim: true },
  paidAt: { type: Date, default: null },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
