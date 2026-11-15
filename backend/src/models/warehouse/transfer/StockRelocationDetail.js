import mongoose from 'mongoose';

const stockRelocationDetailSchema = new mongoose.Schema({
  relocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockRelocation', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  fromStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', required: true },
  toStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  confirmedQuantity: { type: Number, min: 0, validate: Number.isInteger, default: null },
  confirmedItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  confirmedAt: { type: Date, default: null },
}, { timestamps: true });

stockRelocationDetailSchema.index({ relocationId: 1, variantId: 1, fromStorageId: 1, toStorageId: 1 });
export const StockRelocationDetail = mongoose.models.StockRelocationDetail || mongoose.model('StockRelocationDetail', stockRelocationDetailSchema);
