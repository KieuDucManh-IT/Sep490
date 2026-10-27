import mongoose from 'mongoose';

const rentalOrderDetailSchema = new mongoose.Schema({
  rentalOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalOrder', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitRentalFee: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  depositPerUnit: { type: Number, min: 0, default: 0 },
  startDate: { type: Date },
  dueDate: { type: Date },
  note: { type: String, trim: true },
}, { timestamps: true });

export const RentalOrderDetail = mongoose.models.RentalOrderDetail || mongoose.model('RentalOrderDetail', rentalOrderDetailSchema);
