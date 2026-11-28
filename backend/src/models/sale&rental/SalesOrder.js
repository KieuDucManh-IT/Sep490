import mongoose from 'mongoose';
const evidenceVideoSchema = new mongoose.Schema({
  publicId: { type: String, required: true },
  format: { type: String, required: true },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const salesOrderSchema = new mongoose.Schema({
  packingVideo: {
    type: evidenceVideoSchema,
    default: null,
    select: false,
  },
  receivingVideo: {
    type: evidenceVideoSchema,
    default: null,
    select: false,
  },
  returnVideo: {
    type: evidenceVideoSchema,
    default: null,
    select: false,
  },
  returnReceivedVideo: {
    type: evidenceVideoSchema,
    default: null,
    select: false,
  },
  returnStatus: {
    type: String,
    default: 'none',
    enum: ['none', 'requested', 'returning', 'received', 'completed'],
  },
  returnId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesReturn',
    default: null,
  },
  returnCompletedAt: { type: Date, default: null },
  refundedAmount: { type: Number, min: 0, default: 0 },
  returnFlowVersion: { type: Number, default: 0 },
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
    isNewAddress: { type: Boolean, default: false },
  },
  paidAmount: { type: Number, default: 0 },
  paymentRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction', default: null },
  confirmedAt: { type: Date, default: null },
  shippedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, trim: true, default: null },
  ghnCreateAttempts: { type: Number, default: 0, min: 0 },
  note: { type: String, trim: true },
}, { timestamps: true });

export const SalesOrder = mongoose.models.SalesOrder || mongoose.model('SalesOrder', salesOrderSchema);
