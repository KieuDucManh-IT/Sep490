import mongoose from 'mongoose';

const stockRelocationSchema = new mongoose.Schema({
  relocationCode: { type: String, required: true, unique: true, trim: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Phiếu mới luôn 'move' (di chuyển giữa các kệ); 'split' / 'merge' chỉ còn ở dữ liệu cũ.
  operationType: { type: String, required: true, enum: ['move', 'split', 'merge'], default: 'move', index: true },
  status: { type: String, default: 'assigned', enum: ['assigned', 'in_progress', 'completed', 'cancelled'], index: true },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

export const StockRelocation = mongoose.models.StockRelocation || mongoose.model('StockRelocation', stockRelocationSchema);
