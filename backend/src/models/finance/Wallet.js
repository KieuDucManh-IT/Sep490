import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, min: 0, required: true, default: 0 },
  currency: { type: String, default: 'VND', enum: ['VND'] },
  status: { type: String, default: 'active', enum: ['active', 'locked', 'closed'] },
}, { timestamps: true });

export const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
