import mongoose from 'mongoose';

const rentalReturnSchema = new mongoose.Schema({
  returnCode: { type: String, required: true, unique: true, trim: true },
  rentalOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalOrder', required: true, index: true },
  shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderShipment', default: null, index: true },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  returnStatus: { type: String, default: 'received', enum: ['received', 'inspecting', 'completed', 'rejected'] },
  returnedAt: { type: Date, default: Date.now },
  lateFee: { type: Number, min: 0, default: 0 },
  damageFee: { type: Number, min: 0, default: 0 },
  depositRefunded: { type: Number, min: 0, default: 0 },
  damageMode: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed',
  },

  damageValue: {
    type: Number,
    min: 0,
    default: 0,
  },

  depositSettled: {
    type: Number,
    min: 0,
    default: 0,
  },

  collectedLateFee: {
    type: Number,
    min: 0,
    default: 0,
  },

  collectedDamageFee: {
    type: Number,
    min: 0,
    default: 0,
  },

  totalDeducted: {
    type: Number,
    min: 0,
    default: 0,
  },

  uncollectedAmount: {
    type: Number,
    min: 0,
    default: 0,
  },
  note: { type: String, trim: true },
}, { timestamps: true });

export const RentalReturn = mongoose.models.RentalReturn || mongoose.model('RentalReturn', rentalReturnSchema);
