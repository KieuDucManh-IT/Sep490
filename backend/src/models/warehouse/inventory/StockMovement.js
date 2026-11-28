import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  movementType: { type: String, required: true, enum: ['inbound', 'outbound', 'transfer_out', 'transfer_in', 'sale', 'rental_out', 'rental_return', 'sales_return', 'adjustment', 'disposal'] },
  quantityChange: { type: Number, required: true },
  referenceType: { type: String, enum: ['inbound_receipt', 'stock_transfer', 'stock_relocation', 'sales_order', 'rental_order', 'rental_return', 'sales_return', 'stock_adjustment', 'item_disposal', 'item_maintenance', 'stock_discrepancy', 'stocktake'], default: null },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, trim: true, maxlength: 500, default: null },
}, { timestamps: true });

// Lịch sử di chuyển của một mã hàng (GET /warehouse/items/:id/history), mới nhất trước.
stockMovementSchema.index({ itemId: 1, createdAt: -1 });

export const StockMovement = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);
