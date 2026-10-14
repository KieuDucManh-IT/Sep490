import mongoose from 'mongoose';
import './User.js';

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
    },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
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

shopSchema.pre('save', function () {
  if (this.status === 'REJECTED' && !this.rejectionReason?.trim()) {
    throw new Error('Lý do từ chối là bắt buộc khi từ chối hồ sơ.');
  }
});

export const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);
