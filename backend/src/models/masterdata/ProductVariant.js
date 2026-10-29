import mongoose from 'mongoose';

const productVariantSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  sku: { type: String, required: true, unique: true, trim: true },
  variantName: { type: String, trim: true },
  size: { type: String, trim: true },
  color: { type: String, trim: true },
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  salePrice: { type: Number, min: 0 },
  rentalPricePerDay: { type: Number, min: 0 },
  depositAmount: { type: Number, min: 0, default: 0 },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
}, { timestamps: true });

export const ProductVariant = mongoose.models.ProductVariant || mongoose.model('ProductVariant', productVariantSchema);
