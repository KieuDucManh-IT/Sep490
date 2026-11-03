import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    originalName: { type: String, default: '' },
    mimeType: { type: String, default: 'image/jpeg' },
    size: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID là bắt buộc'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID là bắt buộc'],
      index: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'branch_manager', 'owner', 'system'],
      required: true,
    },
    messageType: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'PRODUCT_CARD', 'SYSTEM'],
      default: 'TEXT',
    },
    content: {
      type: String,
      trim: true,
      maxlength: [4000, 'Nội dung tin nhắn tối đa 4000 ký tự'],
      default: '',
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    productCard: {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name: { type: String },
      image: { type: String },
      rentalPrice: { type: Number },
      salePrice: { type: Number },
      productCode: { type: String },
      url: { type: String },
    },
    clientMessageId: {
      type: String,
      trim: true,
      index: true,
    },
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
      default: 'SENT',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'messages',
  }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ clientMessageId: 1, conversationId: 1 });

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
export default Message;

