import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  movementType: { type: String, required: true, enum: ['inbound', 'outbound', 'transfer_out', 'transfer_in', 'sale', 'rental_out', 'rental_return', 'sales_return', 'adjustment', 'disposal'] },
  quantityChange: { type: Number, required: true },
  referenceType: { type: String, enum: ['inbound_receipt', 'stock_transfer', 'sales_order', 'rental_order', 'rental_return', 'sales_return', 'stock_adjustment', 'item_disposal'], default: null },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const StockMovement = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);
