import mongoose from 'mongoose';

const inboundReceiptSchema = new mongoose.Schema({
  receiptCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  supplierName: { type: String, trim: true },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransfer', default: null },
  receiptType: { type: String, required: true, enum: ['supplier', 'transfer', 'customer_return'] },
  status: { type: String, default: 'draft', enum: ['draft', 'checking', 'confirmed', 'rejected', 'cancelled'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

export const InboundReceipt = mongoose.models.InboundReceipt || mongoose.model('InboundReceipt', inboundReceiptSchema);
