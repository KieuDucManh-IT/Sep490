import mongoose from 'mongoose';

const wardrobeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    guestId: {
      type: String,
      default: null,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    productCode: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    tryOnImageUrl: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      default: 'Thời trang cao cấp',
    },
    typeBadge: {
      type: String,
      default: 'rental',
    },
    matchScore: {
      type: Number,
      default: 98,
    },
    aiNote: {
      type: String,
      default: 'Đã thử qua AI Try-On thành công. Thiết kế vừa vặn và tôn vóc dáng.',
    },
    price: {
      type: Number,
      default: 0,
    },
    priceUnit: {
      type: String,
      default: '/ ngày',
    },
    selectedSize: {
      type: String,
      default: 'S',
    },
    tags: {
      type: [String],
      default: ['tryon-history', 'ai-suggested'],
    },
  },
  { timestamps: true }
);

export const Wardrobe =
  mongoose.models.Wardrobe || mongoose.model('Wardrobe', wardrobeSchema);
export default Wardrobe;

