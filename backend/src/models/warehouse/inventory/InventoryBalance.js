import mongoose from 'mongoose';

const inventoryBalanceSchema = new mongoose.Schema({
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  quantityOnHand: { type: Number, required: true, min: 0, default: 0 },
  quantityReserved: { type: Number, required: true, min: 0, default: 0 },
  quantityUnavailable: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

inventoryBalanceSchema.index({ locationId: 1, storageId: 1, variantId: 1 }, { unique: true });
inventoryBalanceSchema.virtual('quantityAvailable').get(function () {
  return Math.max(0, this.quantityOnHand - this.quantityReserved - this.quantityUnavailable);
});
export const InventoryBalance = mongoose.models.InventoryBalance || mongoose.model('InventoryBalance', inventoryBalanceSchema);
