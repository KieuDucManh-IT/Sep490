import mongoose from 'mongoose';

const orderShipmentSchema = new mongoose.Schema({
  shipmentCode: { type: String, required: true, unique: true, trim: true },
  orderType: { type: String, required: true, enum: ['sale', 'rental'] },
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
  deliveryAddress: { type: String, trim: true },
  deliveryMethod: { type: String, required: true, enum: ['pickup', 'internal', 'carrier'] },
  carrierName: { type: String, trim: true },
  trackingCode: { type: String, trim: true },
  shipmentStatus: { type: String, default: 'preparing', enum: ['preparing', 'shipped', 'delivered', 'failed', 'cancelled'] },
  shippedAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const OrderShipment = mongoose.models.OrderShipment || mongoose.model('OrderShipment', orderShipmentSchema);
