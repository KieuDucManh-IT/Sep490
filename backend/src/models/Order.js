import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  productName: { type: String, required: true },
  orderType: { type: String, enum: ['RENTAL', 'SALE'], default: 'RENTAL' },
  rentalDurationDays: { type: Number, default: 3 },
  rentalPrice: { type: Number, required: true },
  escrowDeposit: { type: Number, required: true },
  escrowStatus: { type: String, enum: ['HOLDING', 'RELEASED', 'PARTIAL_DEDUCTED'], default: 'HOLDING' },
  status: { type: String, enum: ['DEPOSITED', 'SHIPPED', 'ON_RENT', 'RETURNED', 'COMPLETED'], default: 'DEPOSITED' },
  payosTxId: { type: String }
}, { timestamps: true });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
