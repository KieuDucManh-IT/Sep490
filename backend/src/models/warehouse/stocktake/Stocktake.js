import mongoose from 'mongoose';

const stocktakeSchema = new mongoose.Schema({
  stocktakeCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  scopeType: { type: String, required: true, enum: ['full', 'product', 'storage_location'] },
  variantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' }],
  storageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'draft', enum: ['draft', 'in_progress', 'counted', 'approved', 'cancelled'] },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

export const Stocktake = mongoose.models.Stocktake || mongoose.model('Stocktake', stocktakeSchema);
