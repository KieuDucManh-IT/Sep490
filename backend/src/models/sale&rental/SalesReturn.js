import mongoose from 'mongoose';

const salesReturnSchema = new mongoose.Schema({
  returnCode: { type: String, required: true, unique: true, trim: true },
  salesOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  returnStatus: { type: String, default: 'requested', enum: ['requested', 'approved', 'rejected', 'completed', 'cancelled'] },
  returnReason: { type: String, required: true, trim: true },
  refundAmount: { type: Number, min: 0, default: 0 },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

export const SalesReturn = mongoose.models.SalesReturn || mongoose.model('SalesReturn', salesReturnSchema);
