import mongoose from 'mongoose';

const storageLocationSchema = new mongoose.Schema({
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLocation', required: true, index: true },
  parentStorageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StorageLocation', default: null },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ['zone', 'row', 'shelf', 'temporary_area'] },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
}, { timestamps: true });

storageLocationSchema.index({ locationId: 1, code: 1 }, { unique: true });
export const StorageLocation = mongoose.models.StorageLocation || mongoose.model('StorageLocation', storageLocationSchema);
