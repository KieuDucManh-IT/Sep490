import mongoose from 'mongoose';

const rentalReturnDetailSchema = new mongoose.Schema({
  rentalReturnId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalReturn', required: true, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  conditionOnReturn: { type: String, required: true, enum: ['new', 'good', 'worn', 'damaged', 'unrepairable'] },
  itemReturnStatus: { type: String, default: 'accepted', enum: ['accepted', 'damaged', 'missing_parts', 'rejected'] },
  damageFee: { type: Number, min: 0, default: 0 },
  note: { type: String, trim: true },
}, { timestamps: true });

export const RentalReturnDetail = mongoose.models.RentalReturnDetail || mongoose.model('RentalReturnDetail', rentalReturnDetailSchema);
