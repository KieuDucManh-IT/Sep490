import mongoose from 'mongoose';

const stockAdjustmentSchema = new mongoose.Schema({
  adjustmentCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  stocktakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stocktake', default: null },
  reason: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'requested', enum: ['requested', 'approved', 'rejected', 'applied', 'cancelled'] },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

export const StockAdjustment = mongoose.models.StockAdjustment || mongoose.model('StockAdjustment', stockAdjustmentSchema);
