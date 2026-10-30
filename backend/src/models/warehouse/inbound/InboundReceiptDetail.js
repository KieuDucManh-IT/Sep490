import mongoose from 'mongoose';

const inboundReceiptDetailSchema = new mongoose.Schema({
  receiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'InboundReceipt', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  storageAllocations: [{
    storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  }],
  quantityExpected: { type: Number, required: true, min: 0 },
  quantityReceived: { type: Number, required: true, min: 0, default: 0 }, // physically received, including damaged goods
  quantityDamaged: { type: Number, required: true, min: 0, default: 0 }, // must not exceed quantityReceived
  unitCost: { type: Number, required: true, min: 0, default: 0, validate: Number.isFinite },
  note: { type: String, trim: true },
}, { timestamps: true });

inboundReceiptDetailSchema.virtual('quantityAccepted').get(function () {
  return Math.max(0, this.quantityReceived - this.quantityDamaged);
});
inboundReceiptDetailSchema.virtual('quantityShort').get(function () {
  return Math.max(0, this.quantityExpected - this.quantityReceived);
});
export const InboundReceiptDetail = mongoose.models.InboundReceiptDetail || mongoose.model('InboundReceiptDetail', inboundReceiptDetailSchema);
