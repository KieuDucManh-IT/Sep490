import mongoose from 'mongoose';

const businessPolicySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Vui lòng nhập tên chính sách.'],
      trim: true,
      maxlength: [200, 'Tên chính sách không được vượt quá 200 ký tự.'],
    },
    key: {
      type: String,
      trim: true,
      index: true,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Tóm tắt chính sách không được vượt quá 500 ký tự.'],
    },
    content: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      default: '',
      trim: true,
    },
    returnPolicy: {
      returnWindowDays: { type: Number, default: 7 }, // Mặc định cho phép trả trong 7 ngày
      allowReturn: { type: Boolean, default: true }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const BusinessPolicy =
  mongoose.models.BusinessPolicy ||
  mongoose.model('BusinessPolicy', businessPolicySchema);

export default BusinessPolicy;
