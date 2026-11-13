import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    salesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
    },

    kind: {
      type: String,
      enum: ['packing', 'receiving'],
      required: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    uploaderName: {
      type: String,
      required: true,
    },

    originalName: {
      type: String,
      required: true,
      maxlength: 180,
    },

    publicId: {
      type: String,
      required: true,
      unique: true,
    },

    url: {
      type: String,
      required: true,
    },

    format: {
      type: String,
      required: true,
    },

    bytes: {
      type: Number,
      required: true,
    },

    duration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

schema.index({
  salesOrderId: 1,
  createdAt: -1,
});

export const SalesOrderEvidence =
  mongoose.models.SalesOrderEvidence ||
  mongoose.model('SalesOrderEvidence', schema);