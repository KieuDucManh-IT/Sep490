import mongoose from 'mongoose';

// TASK-015: mỗi dòng là một món (`itemId`) hoặc một món mới chưa có mã trong hệ thống (itemId null, `countedItemCode`).
// TASK-016: bỏ `countedCondition`. Nhân viên ghi `countedResult` theo món; lúc bắt đầu kiểm lưu ảnh chụp
// (`statusAtStart`, `storageAtStart`, `locationAtStart`) để lúc duyệt bỏ qua món đã đổi trong lúc kiểm.
// Dòng `isExtra` = món lạ gặp trên kệ mà không có trong danh sách (ảnh chụp lấy lúc ghi nhận).
const stocktakeDetailSchema = new mongoose.Schema({
  stocktakeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stocktake', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  // Kệ dòng thuộc về khi hiển thị: dòng thường = kệ của món lúc bắt đầu; món lạ = kệ đang kiểm.
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  systemQuantity: { type: Number, required: true, min: 0 },
  countedQuantity: { type: Number, required: true, min: 0 },
  countedResult: { type: String, enum: ['ok', 'needs_service', 'not_found', null], default: null },
  foundStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  isExtra: { type: Boolean, default: false },
  statusAtStart: { type: String, default: null },
  storageAtStart: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  locationAtStart: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
  // Kết quả áp dụng lúc duyệt (TASK-016 B3).
  appliedOutcome: { type: String, enum: ['unchanged', 'needs_service', 'lost', 'found', 'created', 'relocated', 'skipped', null], default: null },
  skippedReason: { type: String, trim: true, default: null },
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
