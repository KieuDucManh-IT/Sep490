import mongoose from 'mongoose';

const productContextSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: { type: String, required: true },
    productImage: { type: String, default: '' },
    rentalPrice: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    productCode: { type: String, default: '' },
    productUrl: { type: String, default: '' },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop ID là bắt buộc'],
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer ID là bắt buộc'],
      index: true,
    },
    // Danh sách thành viên (Chỉ gồm Customer và đại diện Shop: Brand Manager, Shop Owner)
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    assignedManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    productContexts: {
      type: [productContextSchema],
      default: [],
    },
    lastMessage: {
      content: { type: String, default: '' },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      senderRole: { type: String, default: '' },
      messageType: {
        type: String,
        enum: ['TEXT', 'IMAGE', 'PRODUCT_CARD', 'SYSTEM'],
        default: 'TEXT',
      },
      createdAt: { type: Date, default: Date.now },
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  }
);

// Đảm bảo giữa 1 Customer và 1 Shop chỉ tồn tại duy nhất 1 cuộc trò chuyện
conversationSchema.index({ customerId: 1, shopId: 1 }, { unique: true });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ shopId: 1, lastMessageAt: -1 });

export const Conversation =
  mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
export default Conversation;

