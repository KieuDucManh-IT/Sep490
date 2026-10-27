import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['rental_due', 'rental_overdue', 'transfer_approved', 'transfer_rejected', 'stock_alert', 'payment', 'system', 'other'] },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  referenceType: { type: String, trim: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  deliveryChannel: { type: String, enum: ['in_app', 'email', 'sms', 'push'], default: 'in_app' },
  deliveryStatus: { type: String, enum: ['pending', 'sent', 'failed', 'not_applicable'], default: 'not_applicable' },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
