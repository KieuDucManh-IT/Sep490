import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  parentCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  type: { type: String, required: true, enum: ['lv1', 'lv2', 'lv3'], default: 'lv1', index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
