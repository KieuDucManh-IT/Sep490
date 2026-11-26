import mongoose from 'mongoose';

// TASK-016: bỏ `condition` — trạng thái món là nguồn duy nhất cho biết món dùng được hay không.
// `lost` = đã xác định mất, không tính vào tồn (như `sold`, `disposed`).
const inventoryItemSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true, index: true },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  inboundReceiptDetail: { type: mongoose.Schema.Types.ObjectId, ref: 'InboundReceiptDetail', default: null },
  itemCode: { type: String, required: true, unique: true, trim: true },
  serialNumber: { type: String, trim: true },
  status: { type: String, default: 'available', enum: ['available', 'reserved', 'renting', 'maintenance', 'unavailable', 'in_transit', 'disposed', 'sold', 'lost'] },
}, { timestamps: true });

export const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
