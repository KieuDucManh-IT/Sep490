import mongoose from 'mongoose';

const stocktakeSchema = new mongoose.Schema({
  stocktakeCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  scopeType: { type: String, required: true, enum: ['full', 'product', 'storage_location', 'custom'] },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  variantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' }],
  storageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation' }],
  // Cặp (biến thể, vị trí) WM đã chọn khi tạo phiếu; rỗng = mọi dòng trong phạm vi (hành vi cũ).
  selectedLines: [{
    _id: false,
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'draft', enum: ['draft', 'in_progress', 'counted', 'approved', 'cancelled'] },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });

export const Stocktake = mongoose.models.Stocktake || mongoose.model('Stocktake', stocktakeSchema);
