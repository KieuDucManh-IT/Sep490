import mongoose from 'mongoose';

const salesOrderSchema = new mongoose.Schema({
  orderCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderStatus: { type: String, default: 'draft', enum: ['draft', 'confirmed', 'processing', 'completed', 'cancelled'] },
  paymentStatus: { type: String, default: 'unpaid', enum: ['unpaid', 'partial', 'paid', 'refunded', 'partially_refunded'] },
  subtotal: { type: Number, min: 0, required: true, default: 0 },
  discountAmount: { type: Number, min: 0, default: 0 },
  totalAmount: { type: Number, min: 0, required: true, default: 0 },
  confirmedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  note: { type: String, trim: true },
}, { timestamps: true });

export const SalesOrder = mongoose.models.SalesOrder || mongoose.model('SalesOrder', salesOrderSchema);
