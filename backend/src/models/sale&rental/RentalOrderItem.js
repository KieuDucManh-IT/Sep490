import mongoose from 'mongoose';

const rentalOrderItemSchema = new mongoose.Schema({
  rentalOrderDetailId: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalOrderDetail', required: true, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  status: { type: String, default: 'assigned', enum: ['assigned', 'handed_over', 'returned', 'missing', 'damaged'] },
  handedOverAt: { type: Date, default: null },
  note: { type: String, trim: true },
}, { timestamps: true });

rentalOrderItemSchema.index({ rentalOrderDetailId: 1, itemId: 1 }, { unique: true });
export const RentalOrderItem = mongoose.models.RentalOrderItem || mongoose.model('RentalOrderItem', rentalOrderItemSchema);
