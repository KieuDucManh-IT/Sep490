import mongoose from 'mongoose';

const inventoryReservationSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  orderType: { type: String, required: true, enum: ['sale', 'rental', 'transfer'] },
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1 },
  reservedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  status: { type: String, default: 'active', enum: ['active', 'consumed', 'released', 'expired'] },
}, { timestamps: true });

export const InventoryReservation = mongoose.models.InventoryReservation || mongoose.model('InventoryReservation', inventoryReservationSchema);
