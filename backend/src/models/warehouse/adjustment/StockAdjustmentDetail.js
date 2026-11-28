import mongoose from 'mongoose';

const stockAdjustmentDetailSchema = new mongoose.Schema({
  adjustmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockAdjustment', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  itemCode: { type: String, trim: true, default: null },
  serialNumber: { type: String, trim: true, default: null },
  // TASK-016: bỏ `itemCondition`; thêm `lost`. `itemStatus` = trạng thái món sau khi áp dụng.
  itemStatus: { type: String, enum: ['available', 'reserved', 'maintenance', 'unavailable', 'lost'], default: 'available' },
  // Kệ nguồn của món (dòng món mới / tìm thấy: kệ đặt món).
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  // Người dùng chốt 28/11: duyệt kiểm kê sinh phiếu điều chỉnh, mỗi dòng lệch một dòng. Dòng cũ không có `action`
  // (−1 = mất, +1 = món mới). lost / create / found đổi số tồn; needs_service / relocate chỉ đổi trạng thái / kệ.
  action: { type: String, enum: ['lost', 'create', 'found', 'needs_service', 'relocate', null], default: null },
  stocktakeDetailId: { type: mongoose.Schema.Types.ObjectId, ref: 'StocktakeDetail', default: null },
  toStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  // Trạng thái món lúc duyệt kiểm kê; lúc áp dụng khác → 409 (món đã đổi sau khi duyệt).
  expectedStatus: { type: String, default: null },
  expectedLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
  expectedStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  targetStatus: { type: String, default: null },
  targetLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
  targetStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  // -1: nhả giữ của phiếu di chuyển kệ đang giữ món (món reserved bị ghi mất / cần xử lý).
  warehouseHold: { type: Number, enum: [-1, 0], default: 0 },
  releaseHold: { type: Boolean, default: false },
  quantityBefore: { type: Number, min: 0 },
  quantityChange: { type: Number, required: true },
  quantityAfter: { type: Number, min: 0 },
  reason: { type: String, trim: true },
}, { timestamps: true });

export const StockAdjustmentDetail = mongoose.models.StockAdjustmentDetail || mongoose.model('StockAdjustmentDetail', stockAdjustmentDetailSchema);
