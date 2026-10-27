import mongoose from 'mongoose';

const salesOrderDetailSchema = new mongoose.Schema({
  salesOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, min: 0, default: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { timestamps: true });

export const SalesOrderDetail = mongoose.models.SalesOrderDetail || mongoose.model('SalesOrderDetail', salesOrderDetailSchema);
