import mongoose from 'mongoose';
import '../system/User.js';

export const DEFAULT_SHOP_IMAGE =
  'https://res.cloudinary.com/dw00bqqfi/image/upload/v1793286849/vestora/shops/avatar/1793286868885-6a291daa-8576-4622-bfde-842ca9b65cc6.webp';
export const DEFAULT_SHOP_BANNER =
  'https://res.cloudinary.com/dw00bqqfi/image/upload/v1793286857/vestora/shops/banner/1793286876464-e4aff2b7-36c9-45c7-85a0-f89084b489d5.webp';

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
    imageUrl: { type: String, default: DEFAULT_SHOP_IMAGE, trim: true },
    bannerUrl: { type: String, default: DEFAULT_SHOP_BANNER, trim: true },
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

export const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);
export default Shop;

