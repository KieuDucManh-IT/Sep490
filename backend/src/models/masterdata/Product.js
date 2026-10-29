import mongoose from 'mongoose';
import './Category.js';
import '../Shop.js';

const productSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  productCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  productType: { type: String, default: 'both', enum: ['sale', 'rental', 'both'] },
  tag: { type: String, enum: ['sale', 'rental', 'both'] },
  trackingType: { type: String, default: 'quantity', enum: ['quantity', 'individual'] },
  images: [{ type: String }],
  brand: { type: String, trim: true },
  material: { type: String, trim: true },
  category: [{ type: String }],
  sizes: [{ type: String }],
  colors: [{ type: String }],
  condition: { type: String, default: 'very_good' },
  rating: { type: Number, default: 4.8 },
  reviewsCount: { type: Number, default: 50 },
  rentalPricePerDay: { type: Number, default: 0 },
  rentalPricePer3Days: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  deposit: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  inStock: { type: Boolean, default: true },
  aiTryOn: { type: Boolean, default: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  status: { type: String, default: 'active', enum: ['active', 'inactive', 'discontinued'] },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true, strict: false });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
