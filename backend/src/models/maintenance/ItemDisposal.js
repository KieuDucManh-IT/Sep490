import mongoose from 'mongoose';

const itemDisposalSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  reason: { type: String, required: true, trim: true },
  method: { type: String, required: true, enum: ['discard', 'sell_as_is', 'recycle', 'donate', 'other'] },
  estimatedValue: { type: Number, min: 0, default: null },
  actualValue: { type: Number, min: 0, default: null },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'requested', enum: ['requested', 'approved', 'rejected', 'completed'] },
  approvedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

export const ItemDisposal = mongoose.models.ItemDisposal || mongoose.model('ItemDisposal', itemDisposalSchema);
