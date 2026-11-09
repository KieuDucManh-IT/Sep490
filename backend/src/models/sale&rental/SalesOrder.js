import mongoose from 'mongoose';

const salesOrderSchema = new mongoose.Schema({
  orderCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderStatus: { type: String, default: 'draft', enum: ['draft', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'] },
  paymentStatus: { type: String, default: 'unpaid', enum: ['unpaid', 'partial', 'paid', 'refunded', 'partially_refunded'] },
  paymentMethod: { type: String, default: 'cod', enum: ['wallet', 'cod'] },
  subtotal: { type: Number, min: 0, required: true, default: 0 },
  discountAmount: { type: Number, min: 0, default: 0 },
  shippingFee: { type: Number, min: 0, default: 0 },
  totalAmount: { type: Number, min: 0, required: true, default: 0 },
  deliveryMethod: { type: String, enum: ['delivery', 'pickup', 'carrier'], default: 'delivery' },
  shippingAddress: {
    receiverName: { type: String, trim: true },
    phone: { type: String, trim: true },
    street: { type: String, trim: true },
    ward: { type: String, trim: true },
    district: { type: String, trim: true },
    city: { type: String, trim: true },
    provinceId: { type: Number, default: null },
    districtId: { type: Number, default: null },
    wardCode: { type: String, trim: true, default: null },
  },
  paidAmount: { type: Number, default: 0 },
  paymentRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
  confirmedAt: { type: Date, default: null },
  shippedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  note: { type: String, trim: true },
}, { timestamps: true });

export const SalesOrder = mongoose.models.SalesOrder || mongoose.model('SalesOrder', salesOrderSchema);
