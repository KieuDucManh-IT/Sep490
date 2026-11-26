import mongoose from 'mongoose';

const itemMaintenanceRecordSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true, index: true },
  sourceType: { type: String, enum: ['rental_return', 'stocktake', 'warehouse_inspection', 'transfer', 'other'], default: 'other' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  maintenanceType: { type: String, required: true, enum: ['cleaning', 'repair', 'inspection', 'replacement_part', 'other'] },
  issueDescription: { type: String, required: true, trim: true },
  repairDescription: { type: String, trim: true },
  // TASK-016: bỏ beforeCondition/afterCondition (phiếu cũ còn giữ trong DB làm lịch sử); kết quả nằm ở repairResult.
  previousItemStatus: { type: String, default: null },
  targetStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  repairResult: { type: String, enum: ['success', 'failed', 'unrepairable', null], default: null },
  status: { type: String, default: 'pending', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
  // true khi status là pending | in_progress. Dùng cho partial unique index (tránh $in trong partialFilterExpression, cần MongoDB >= 6.0).
  isOpen: { type: Boolean, default: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cost: { type: Number, min: 0, default: 0 },
  reportedAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note: { type: String, trim: true },
}, { timestamps: true });

itemMaintenanceRecordSchema.index({ itemId: 1 }, { unique: true, partialFilterExpression: { isOpen: true }, name: 'uniq_open_maintenance_per_item' });

export const ItemMaintenanceRecord = mongoose.models.ItemMaintenanceRecord || mongoose.model('ItemMaintenanceRecord', itemMaintenanceRecordSchema);
