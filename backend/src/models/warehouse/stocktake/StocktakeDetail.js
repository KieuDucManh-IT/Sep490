import mongoose from 'mongoose';

const stocktakeDetailSchema = new mongoose.Schema({
  stocktakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stocktake', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  systemQuantity: { type: Number, required: true, min: 0 },
  countedQuantity: { type: Number, required: true, min: 0 },
  countedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, trim: true },
}, { timestamps: true });

stocktakeDetailSchema.virtual('varianceQuantity').get(function () {
  return this.countedQuantity - this.systemQuantity;
});
export const StocktakeDetail = mongoose.models.StocktakeDetail || mongoose.model('StocktakeDetail', stocktakeDetailSchema);
