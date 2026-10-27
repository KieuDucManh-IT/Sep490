import mongoose from 'mongoose';

const itemMaintenanceRecordSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
  sourceType: { type: String, enum: ['rental_return', 'stocktake', 'warehouse_inspection', 'transfer', 'other'], default: 'other' },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  maintenanceType: { type: String, required: true, enum: ['cleaning', 'repair', 'inspection', 'replacement_part', 'other'] },
  issueDescription: { type: String, required: true, trim: true },
  repairDescription: { type: String, trim: true },
  beforeCondition: { type: String, enum: ['new', 'good', 'worn', 'damaged', 'unrepairable'] },
  afterCondition: { type: String, enum: ['new', 'good', 'worn', 'damaged', 'unrepairable'] },
  repairResult: { type: String, enum: ['success', 'failed', 'unrepairable'], default: null },
  status: { type: String, default: 'pending', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cost: { type: Number, min: 0, default: 0 },
  reportedAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  note: { type: String, trim: true },
}, { timestamps: true });

export const ItemMaintenanceRecord = mongoose.models.ItemMaintenanceRecord || mongoose.model('ItemMaintenanceRecord', itemMaintenanceRecordSchema);
