import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true, index: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true, index: true },
  storageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  itemCode: { type: String, required: true, unique: true, trim: true },
  serialNumber: { type: String, trim: true },
  condition: { type: String, default: 'good', enum: ['new', 'good', 'worn', 'damaged', 'unrepairable'] },
  status: { type: String, default: 'available', enum: ['available', 'reserved', 'renting', 'maintenance', 'unavailable', 'disposed'] },
  
}, { timestamps: true });

export const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
