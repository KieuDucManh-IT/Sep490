import mongoose from 'mongoose';

const salesReturnDetailSchema = new mongoose.Schema({
  salesReturnId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesReturn', required: true, index: true },
  salesOrderDetailId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrderDetail', required: true },
  quantityReturned: { type: Number, required: true, min: 1 },
  unitRefundAmount: { type: Number, required: true, min: 0 },
  conditionOnReturn: { type: String, required: true, enum: ['new', 'good', 'worn', 'damaged', 'unrepairable'] },
  disposition: { type: String, required: true, enum: ['restock', 'quarantine', 'repair', 'dispose'] },
  note: { type: String, trim: true },
}, { timestamps: true });

export const SalesReturnDetail = mongoose.models.SalesReturnDetail || mongoose.model('SalesReturnDetail', salesReturnDetailSchema);
