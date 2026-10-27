import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, trim: true },
  entityType: { type: String, required: true, trim: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  oldValues: { type: mongoose.Schema.Types.Mixed, default: null },
  newValues: { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress: { type: String, trim: true },
}, { timestamps: true });

export const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', systemLogSchema);
