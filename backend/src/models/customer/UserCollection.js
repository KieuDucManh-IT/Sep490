import mongoose from 'mongoose';
import '../system/User.js';

const userCollectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId là bắt buộc'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Tên bộ sưu tập là bắt buộc'],
      trim: true,
      maxlength: [100, 'Tên bộ sưu tập không được vượt quá 100 ký tự'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Mô tả không được vượt quá 500 ký tự'],
      default: '',
    },
    coverImageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPrivate: {
      type: Boolean,
      default: true,
      index: true,
    },
    shareCode: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    eventDate: {
      type: Date,
      default: null,
    },
    itemCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Đảm bảo tên BST là duy nhất đối với cùng một người dùng
userCollectionSchema.index({ userId: 1, name: 1 }, { unique: true });

// Tối ưu hóa truy vấn xem Lookbook công khai theo shareCode
userCollectionSchema.index({ isPrivate: 1, shareCode: 1 });

export const UserCollection =
  mongoose.models.UserCollection ||
  mongoose.model('UserCollection', userCollectionSchema);

export default UserCollection;
