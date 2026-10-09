import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  retailValue: { type: String, required: true },
  rental3DaysPrice: { type: Number, required: true },
  resalePrice: { type: Number, required: true },
  escrowDeposit: { type: Number, required: true },
  sizeStock: {
    S: { type: Number, default: 0 },
    M: { type: Number, default: 0 },
    L: { type: Number, default: 0 },
    XL: { type: Number, default: 0 }
  },
  images: [{ type: String }],
  isApproved: { type: Boolean, default: true }
}, { timestamps: true });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
