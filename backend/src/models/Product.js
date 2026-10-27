import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },

  sku: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  images: [{ type: String }],
  brand: { type: String, trim: true },
  material: { type: String, trim: true },

  category: [{ type: String}],
  tag: {type: String, required: true, default: "sale",
      enum: ["sale", "rental", "both"],
    },

  rentalPricePerDay: { type: Number, min: 0},
  deposit: { type: Number, min: 0, default: 0},
  salePrice: { type: Number, min: 0},
  discount: { type: Number, min: 0, max: 100, default: 0},
  
  isDeleted: { type: Boolean, default: false },
  status: { type: String, default: "pending",
    enum: ["pending", "active", "inactive", "rejected"]
  }

}, { timestamps: true });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
