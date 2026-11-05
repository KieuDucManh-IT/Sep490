import mongoose from 'mongoose';

const inboundReceiptSchema = new mongoose.Schema({
  receiptCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null, required: function requiredSupplier() { return this.receiptType === 'supplier'; } },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransfer', default: null },
  receiptType: { type: String, required: true, enum: ['supplier', 'transfer', 'customer_return'] },
  status: { type: String, default: 'awaiting_receiving', enum: ['awaiting_receiving', 'received', 'approved', 'completed', 'rejected', 'cancelled'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receivedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  putawayBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  putawayAt: { type: Date, default: null },
  note: { type: String, trim: true, default: '' },
}, { timestamps: true });

export const InboundReceipt = mongoose.models.InboundReceipt || mongoose.model('InboundReceipt', inboundReceiptSchema);
