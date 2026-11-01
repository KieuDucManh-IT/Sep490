import mongoose from 'mongoose';

const stocktakeDetailSchema = new mongoose.Schema({
  stocktakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stocktake', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  systemQuantity: { type: Number, required: true, min: 0 },
  countedQuantity: { type: Number, required: true, min: 0 },
  countedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  countedAt: { type: Date, default: null },
  isCounted: { type: Boolean, default: false },
  movementAfterCount: { type: Number, default: 0 },
  countedItemCode: { type: String, trim: true, default: null },
  countedSerialNumber: { type: String, trim: true, default: null },
  note: { type: String, trim: true },
}, { timestamps: true });

stocktakeDetailSchema.virtual('varianceQuantity').get(function () {
  return this.countedQuantity + (this.movementAfterCount || 0) - this.systemQuantity;
});
export const StocktakeDetail = mongoose.models.StocktakeDetail || mongoose.model('StocktakeDetail', stocktakeDetailSchema);
