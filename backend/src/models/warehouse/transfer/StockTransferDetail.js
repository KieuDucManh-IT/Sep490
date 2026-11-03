import mongoose from 'mongoose';

const stockTransferDetailSchema = new mongoose.Schema({
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransfer', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  fromStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  receivedItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  damagedItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  quantityRequested: { type: Number, required: true, min: 1, validate: Number.isInteger },
  quantityApproved: { type: Number, min: 0, validate: Number.isInteger },
  quantityShipped: { type: Number, min: 0, default: 0, validate: Number.isInteger },
  quantityReceived: { type: Number, min: 0, default: 0, validate: Number.isInteger },
  quantityDamaged: { type: Number, min: 0, default: 0, validate: Number.isInteger },
  quantityMissing: { type: Number, min: 0, default: 0, validate: Number.isInteger },
  note: { type: String, trim: true },
}, { timestamps: true });

export const StockTransferDetail = mongoose.models.StockTransferDetail || mongoose.model('StockTransferDetail', stockTransferDetailSchema);
