import mongoose from 'mongoose';

const salesReturnDetailSchema = new mongoose.Schema({
  salesReturnId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesReturn', required: true, index: true },
  salesOrderDetailId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrderDetail', required: true },
  quantityReturned: { type: Number, required: true, min: 1 },
  // TASK-015: các món được trả (chọn trong số món đã bán của đơn); số món = quantityReturned.
  itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  unitRefundAmount: { type: Number, required: true, min: 0 },
  // TASK-016: kết quả kiểm theo món thay cho conditionOnReturn/disposition (phiếu cũ còn field cũ trong DB).
  inspectionResults: [{
    _id: false,
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    result: { type: String, required: true, enum: ['ok', 'needs_service'] },
  }],
  note: { type: String, trim: true },
}, { timestamps: true });

export const SalesReturnDetail = mongoose.models.SalesReturnDetail || mongoose.model('SalesReturnDetail', salesReturnDetailSchema);
