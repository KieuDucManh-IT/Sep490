import mongoose from 'mongoose';
import './Category.js';
import '../Shop.js';

const productSchema = new mongoose.Schema({
  categoryId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }],
  category: [{ type: String }],
  productCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  tag: { type: String, enum: ['sale', 'rental', 'both'] },
  trackingType: { type: String, default: 'quantity', enum: ['quantity', 'individual'] },
  brand: { type: String, trim: true },
  material: { type: String, trim: true },
  rating: { type: Number, default: 5.0, min: 0, max: 5 },
  reviewsCount: { type: Number, default: 50 },
  rentalPricePerDay: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  deposit: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  inStock: { type: Boolean, default: true },
  aiTryOn: { type: Boolean, default: true },
  status: { type: String, default: 'active', enum: ['active', 'inactive', 'discontinued'] },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true, strict: false });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
