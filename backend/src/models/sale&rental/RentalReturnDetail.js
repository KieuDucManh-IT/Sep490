import mongoose from 'mongoose';

const rentalReturnDetailSchema = new mongoose.Schema({
  rentalReturnId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalReturn', required: true, index: true },
  rentalOrderDetailId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalOrderDetail', default: null },
  quantityReturned: { type: Number, min: 1, default: 1 },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
  // TASK-016: kết quả kiểm thay cho conditionOnReturn/itemReturnStatus (phiếu cũ vẫn còn field cũ trong DB, code mới không đọc).
  // ok → available; needs_service → unavailable; missing → lost (RentalOrderItem.status = missing).
  inspectionResult: { type: String, required: true, enum: ['ok', 'needs_service', 'missing'] },
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
  damageBaseValue: {
    type: Number,
    min: 0,
    default: null,
  },
  assessedDamageFee: {
    type: Number,
    min: 0,
    default: 0,
  },
  damageFee: { type: Number, min: 0, default: 0 },
  note: { type: String, trim: true },
}, { timestamps: true });

export const RentalReturnDetail = mongoose.models.RentalReturnDetail || mongoose.model('RentalReturnDetail', rentalReturnDetailSchema);
