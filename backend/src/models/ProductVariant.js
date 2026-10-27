import mongoose from 'mongoose';

const productVariantSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },

  size: { type: Number, required: true },
  color: { type: String, required: true },
  condition: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },

  status: { type: String, default: "active",
    enum: ["active", "inactive", "maintenance"]
   },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export const ProductVariant = mongoose.models.ProductVariant || mongoose.model('ProductVariant', productVariantSchema);
