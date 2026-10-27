import mongoose from 'mongoose';

const stockAdjustmentDetailSchema = new mongoose.Schema({
  adjustmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockAdjustment', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  quantityBefore: { type: Number, min: 0 },
  quantityChange: { type: Number, required: true },
  quantityAfter: { type: Number, min: 0 },
  reason: { type: String, trim: true },
}, { timestamps: true });

export const StockAdjustmentDetail = mongoose.models.StockAdjustmentDetail || mongoose.model('StockAdjustmentDetail', stockAdjustmentDetailSchema);
