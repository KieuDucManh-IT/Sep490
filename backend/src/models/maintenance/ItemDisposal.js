import mongoose from 'mongoose';

const itemDisposalSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true, index: true },
  maintenanceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemMaintenanceRecord', default: null },
  reason: { type: String, required: true, trim: true },
  method: { type: String, required: true, enum: ['discard', 'sell_as_is', 'recycle', 'donate', 'other'] },
  estimatedValue: { type: Number, min: 0, default: null },
  actualValue: { type: Number, min: 0, default: null },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'requested', enum: ['requested', 'approved', 'rejected', 'completed'] },
  // true khi status là requested. Dùng cho partial unique index: mỗi món tối đa 1 đề xuất đang chờ duyệt.
  isPending: { type: Boolean, default: true },
  decisionNote: { type: String, trim: true, default: '' },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

itemDisposalSchema.index({ itemId: 1 }, { unique: true, partialFilterExpression: { isPending: true }, name: 'uniq_pending_disposal_per_item' });

export const ItemDisposal = mongoose.models.ItemDisposal || mongoose.model('ItemDisposal', itemDisposalSchema);
