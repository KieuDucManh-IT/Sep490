import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    rentalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentalOrder',
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
  rentalOrderId: 1,
  createdAt: -1,
});

export const RentalOrderEvidence =
  mongoose.models.RentalOrderEvidence ||
  mongoose.model('RentalOrderEvidence', schema);