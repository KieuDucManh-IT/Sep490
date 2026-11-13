import mongoose from 'mongoose';

const stockTransferSchema = new mongoose.Schema({
  transferCode: { type: String, required: true, unique: true, trim: true },
  direction: { type: String, default: 'central_to_branch', enum: ['central_to_branch', 'branch_to_central'], index: true },
  fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  shippedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'requested', enum: ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'partially_received', 'received', 'receipt_submitted', 'receipt_approved', 'completed', 'cancelled'] },
  approvedAt: { type: Date, default: null },
  shippedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  putawayBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  putawayAt: { type: Date, default: null },
  receiptApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receiptApprovedAt: { type: Date, default: null },
  note: { type: String, trim: true },
}, { timestamps: true });

export const StockTransfer = mongoose.models.StockTransfer || mongoose.model('StockTransfer', stockTransferSchema);
