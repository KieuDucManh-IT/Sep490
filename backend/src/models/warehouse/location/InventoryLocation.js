import mongoose from 'mongoose';

const inventoryLocationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ['warehouse', 'store'] },
  address: { type: String, trim: true },
  maxCapacity: { type: Number, min: 0, validate: Number.isInteger, default: null },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null }
}, { timestamps: true });

export const InventoryLocation = mongoose.models.InventoryLocation || mongoose.model('InventoryLocation', inventoryLocationSchema);
