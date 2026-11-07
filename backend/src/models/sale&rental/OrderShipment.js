import mongoose from 'mongoose';

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true }, // preparing, shipped, delivered, failed, cancelled
  ghnStatus: { type: String, trim: true },  // raw status code from GHN
  description: { type: String, trim: true },
  location: { type: String, trim: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const addressInfoSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  provinceId: { type: Number },
  wardCode: { type: String, trim: true },
}, { _id: false });

const orderShipmentSchema = new mongoose.Schema({
  trackingCode: { type: String, required: true, unique: true, trim: true }, 
  orderType: { type: String, required: true, enum: ['sale', 'rental'] },
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fromShopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true }, 
  carrierName: { type: String, trim: true, default: 'Giao Hàng Nhanh' },
  shipmentType: { type: String, enum: ['outbound', 'return'], default: 'outbound' },
  shipmentStatus: { type: String, default: 'preparing', enum: ['preparing', 'shipped', 'delivered', 'failed', 'cancelled'] },
  shippingFee: { type: Number, min: 0, default: 0 },
  codAmount: { type: Number, min: 0, default: 0 },
  weight: { type: Number, min: 0, default: 500 }, // grams
  length: { type: Number, min: 0, default: 30 },  // cm
  width: { type: Number, min: 0, default: 20 },   // cm
  height: { type: Number, min: 0, default: 10 },  // cm
  expectedDeliveryTime: { type: Date, default: null },
  senderInfo: { type: addressInfoSchema, default: null },
  receiverInfo: { type: addressInfoSchema, default: null },
  statusHistory: [statusHistorySchema],
  lastSyncedAt: { type: Date, default: null },
  cancellationReason: { type: String, trim: true },
  note: { type: String, trim: true },
  shippedAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

orderShipmentSchema.index({ orderId: 1, orderType: 1 });

export const OrderShipment = mongoose.models.OrderShipment || mongoose.model('OrderShipment', orderShipmentSchema);
