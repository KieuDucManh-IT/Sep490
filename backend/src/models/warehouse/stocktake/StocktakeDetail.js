import mongoose from 'mongoose';

// Số không âm hoặc để trống (null/undefined): dữ liệu cũ không có field vẫn lưu được.
const optionalNonNegativeInteger = {
  validator: (value) => value == null || (Number.isInteger(value) && value >= 0),
  message: 'Số hàng hỏng phải là số nguyên không âm.',
};

const stocktakeDetailSchema = new mongoose.Schema({
  stocktakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stocktake', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  systemQuantity: { type: Number, required: true, min: 0 },
  countedQuantity: { type: Number, required: true, min: 0 },
  // Hàng quản lý theo số lượng: trong số đếm được có bao nhiêu cái hỏng (vẫn trong tồn, không khả dụng).
  // null = dòng chưa ghi số hỏng (dữ liệu trước khi có field) → duyệt không đụng quantityUnavailable.
  damagedQuantity: { type: Number, default: null, validate: optionalNonNegativeInteger },
  countedCondition: { type: String, enum: ['new', 'good', 'worn', 'damaged', 'unrepairable', 'missing'], default: null },
  countedItemStatus: { type: String, enum: ['available', 'reserved', 'maintenance', 'unavailable'], default: null },
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
