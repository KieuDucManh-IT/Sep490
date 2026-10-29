import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  productCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  productType: { type: String, required: true, enum: ['sale', 'rental', 'both'] },
  trackingType: { type: String, required: true, enum: ['quantity', 'individual'] },
  status: { type: String, default: 'active', enum: ['active', 'inactive', 'discontinued'] },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
