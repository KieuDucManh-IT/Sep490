import mongoose from 'mongoose';
import './UserCollection.js';
import '../system/User.js';
import '../masterdata/Product.js';
import '../masterdata/ProductVariant.js';

const collectionItemSchema = new mongoose.Schema(
  {
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserCollection',
      required: [true, 'collectionId là bắt buộc'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId là bắt buộc'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId là bắt buộc'],
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [300, 'Ghi chú phong cách không được vượt quá 300 ký tự'],
      default: '',
    },
    targetUsageDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ngăn chặn lưu trùng lặp cùng 1 sản phẩm & biến thể trong cùng 1 bộ sưu tập
collectionItemSchema.index(
  { collectionId: 1, productId: 1, variantId: 1 },
  { unique: true }
);

// Tối ưu hóa kiểm tra nhanh trạng thái yêu thích (isWishlisted) theo người dùng
collectionItemSchema.index({ userId: 1, productId: 1 });

export const CollectionItem =
  mongoose.models.CollectionItem ||
  mongoose.model('CollectionItem', collectionItemSchema);

export default CollectionItem;
