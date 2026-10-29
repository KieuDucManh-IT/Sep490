import mongoose from 'mongoose';

const stockTransferDetailSchema = new mongoose.Schema({
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransfer', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  fromStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  toStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  quantityRequested: { type: Number, required: true, min: 1 },
  quantityApproved: { type: Number, min: 0 },
  quantityShipped: { type: Number, min: 0, default: 0 },
  quantityReceived: { type: Number, min: 0, default: 0 },
  note: { type: String, trim: true },
}, { timestamps: true });

export const StockTransferDetail = mongoose.models.StockTransferDetail || mongoose.model('StockTransferDetail', stockTransferDetailSchema);
