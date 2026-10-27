import mongoose from 'mongoose';
import './system/User.js';

const shopSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
      required: [true, 'Địa chỉ gian hàng không được để trống'],
      trim: true,
      minlength: [3, 'Địa chỉ gian hàng phải có ít nhất 3 ký tự'],
    },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
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
    imageUrl: { type: String, default: '' },
    businessLicenseUrl: { type: String, default: '' },
    idCardFrontUrl: { type: String, default: '' },
    idCardBackUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING',
    },
    rejectionReason: { type: String, default: '' },
    notes: { type: String, default: '' },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shopSchema.index({ ownerId: 1, status: 1 });
shopSchema.index({ status: 1, createdAt: -1 });
shopSchema.index({ name: 1 });

shopSchema.pre('save', function () {
  if (this.status === 'REJECTED' && !this.rejectionReason?.trim()) {
    throw new Error('Lý do từ chối là bắt buộc khi từ chối hồ sơ.');
  }
});

export const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);
export default Shop;

