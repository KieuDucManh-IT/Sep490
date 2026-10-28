import mongoose from 'mongoose';
import './User.js';

const shopSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isHQ: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      required: [true, 'Tên gian hàng không được để trống'],
      trim: true,
      minlength: [3, 'Tên gian hàng phải có ít nhất 3 ký tự'],
      maxlength: [100, 'Tên gian hàng không được vượt quá 100 ký tự'],
    },
    description: {
      type: String,
      required: [true, 'Mô tả gian hàng không được để trống'],
      trim: true,
      minlength: [10, 'Mô tả gian hàng phải có ít nhất 10 ký tự'],
      maxlength: [1000, 'Mô tả không được vượt quá 1000 ký tự'],
    },
    phone: {
      type: String,
      required: [true, 'Số điện thoại liên hệ không được để trống'],
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    city: { type: String, default: '' },
    ward: { type: String, default: '' },
    latitude: {
      type: Number,
      default: null,
      min: [-90, 'Vĩ độ không hợp lệ (-90 đến 90)'],
      max: [90, 'Vĩ độ không hợp lệ (-90 đến 90)'],
    },
    longitude: {
      type: Number,
      default: null,
      min: [-180, 'Kinh độ không hợp lệ (-180 đến 180)'],
      max: [180, 'Kinh độ không hợp lệ (-180 đến 180)'],
    },
    imageUrl: { type: String, default: '', trim: true },
    bannerUrl: { type: String, default: '', trim: true },
    openingHours: {
      type: String,
      default: '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED'],
      default: 'ACTIVE',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

shopSchema.index({ ownerId: 1, status: 1 });
shopSchema.index({ managerId: 1 });
shopSchema.index({ city: 1 });
shopSchema.index({ status: 1, createdAt: -1 });
shopSchema.index({ name: 1 });

shopSchema.set('toJSON', { virtuals: true });
shopSchema.set('toObject', { virtuals: true });

/**
 * Virtual alias for backwards compatibility: avatarUrl -> imageUrl
 */
shopSchema.virtual('avatarUrl').get(function () {
  return this.imageUrl || '';
});

export const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);
export default Shop;

