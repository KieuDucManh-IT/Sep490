import mongoose from 'mongoose';

const salesOrderDetailSchema = new mongoose.Schema({
  salesOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true, index: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, min: 0, default: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  // TASK-016 C: các món đã bán của dòng (ghi lúc hoàn tất đơn; đơn cũ điền bằng scripts/backfillSalesOrderItems.js).
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
}, { timestamps: true });

salesOrderDetailSchema.index({ itemIds: 1 });

export const SalesOrderDetail = mongoose.models.SalesOrderDetail || mongoose.model('SalesOrderDetail', salesOrderDetailSchema);
