import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    default: 'system',
    index: true
  },
  link: { type: String, trim: true, default: '' },
  referenceType: { type: String, trim: true, default: '' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  deliveryChannel: { type: String, enum: ['in_app', 'email', 'sms', 'push'], default: 'in_app' },
  deliveryStatus: { type: String, enum: ['pending', 'sent', 'failed', 'not_applicable'], default: 'not_applicable' },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
