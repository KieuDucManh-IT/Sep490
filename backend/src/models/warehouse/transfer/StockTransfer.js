import mongoose from 'mongoose';

const stockTransferSchema = new mongoose.Schema({
  transferCode: { type: String, required: true, unique: true, trim: true },
  fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'requested', enum: ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'partially_received', 'received', 'cancelled'] },
  approvedAt: { type: Date, default: null },
  shippedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  note: { type: String, trim: true },
}, { timestamps: true });

export const StockTransfer = mongoose.models.StockTransfer || mongoose.model('StockTransfer', stockTransferSchema);
