import mongoose from 'mongoose';

// Phiếu chênh lệch (UC-29): mở khi bên nhận chốt nhận hàng mà một dòng điều chuyển bị thiếu.
// Hàng thiếu đã ra khỏi sổ ở bước xuất (transfer_out), nên phiếu này chỉ ghi lại số thiếu và cách kết luận.
// TASK-015: luôn theo món (`itemIds`, `itemPreviousConditions`); field `trackingType` đã bỏ.
const resolutionSchema = new mongoose.Schema({
  outcome: { type: String, required: true, enum: ['found', 'lost'] },
  quantity: { type: Number, required: true, min: 1 },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  targetLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
  targetStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  responsibleParty: { type: String, enum: ['central_warehouse', 'branch', 'carrier', 'unknown'], default: null },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resolvedAt: { type: Date, required: true },
}, { _id: true });

const stockDiscrepancySchema = new mongoose.Schema({
  discrepancyCode: { type: String, required: true, unique: true, trim: true },
  transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransfer', required: true },
  transferDetailId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransferDetail', required: true, unique: true },
  direction: { type: String, required: true, enum: ['central_to_branch', 'branch_to_central'] },
  fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  quantityMissing: { type: Number, required: true, min: 1 },
  quantityResolved: { type: Number, min: 0, default: 0 },
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  itemPreviousConditions: [{
    _id: false,
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    condition: { type: String, default: 'good' },
  }],
  status: { type: String, default: 'open', enum: ['open', 'partially_resolved', 'resolved'] },
  resolutions: [resolutionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

stockDiscrepancySchema.index({ status: 1, createdAt: -1 });
stockDiscrepancySchema.index({ transferId: 1 });

export const StockDiscrepancy = mongoose.models.StockDiscrepancy || mongoose.model('StockDiscrepancy', stockDiscrepancySchema);
