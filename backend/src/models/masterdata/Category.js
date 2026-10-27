import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  parentCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
}, { timestamps: true });

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
