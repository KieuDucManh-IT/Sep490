import mongoose from 'mongoose';
import '../system/User.js';
import './Product.js';
import '../shop/Shop.js';

const reviewSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  orderType: {
    type: String,
    enum: ['sale', 'rental'],
    required: true,
    index: true,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    default: null,
    index: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be an integer between 1 and 5',
    },
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 1000,
  },
  images: [{
    type: String,
    trim: true,
  }],
  reply: {
    content: { type: String, trim: true, default: '' },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    repliedAt: { type: Date, default: null },
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Ensure a customer can only review a specific product within a specific order once
reviewSchema.index({ orderId: 1, productId: 1, customerId: 1 }, { unique: true });

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
