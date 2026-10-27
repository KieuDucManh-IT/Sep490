import mongoose from 'mongoose';

const rentalOrderSchema = new mongoose.Schema({
  orderCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rentalStatus: { type: String, default: 'draft', enum: ['draft', 'confirmed', 'renting', 'partially_returned', 'returned', 'cancelled', 'overdue'] },
  paymentStatus: { type: String, default: 'unpaid', enum: ['unpaid', 'partial', 'paid', 'refunded', 'partially_refunded'] },
  startDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  actualReturnedAt: { type: Date, default: null },
  rentalFee: { type: Number, min: 0, required: true, default: 0 },
  depositAmount: { type: Number, min: 0, required: true, default: 0 },
  depositStatus: { type: String, default: 'pending', enum: ['pending', 'held', 'partially_refunded', 'refunded', 'forfeited', 'partially_deducted'] },
  note: { type: String, trim: true },
}, { timestamps: true });

export const RentalOrder = mongoose.models.RentalOrder || mongoose.model('RentalOrder', rentalOrderSchema);
