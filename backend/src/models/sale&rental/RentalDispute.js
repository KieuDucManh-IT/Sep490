import mongoose from 'mongoose';

/**
 * RentalDispute Model
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-010
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-011
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-012
 */
const rentalDisputeSchema = new mongoose.Schema(
  {
    disputeCode: { type: String, required: true, unique: true, trim: true },
    rentalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentalOrder',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'damaged_in_transit',
        'manufacturing_defect',
        'wrong_item_or_color',
        'missing_accessories',
        'other',
      ],
    },
    description: { type: String, required: true, trim: true },
    evidenceImages: [{ type: String }],
    status: {
      type: String,
      default: 'pending_review',
      enum: [
        'pending_review',
        'approved',
        'rejected',
        'item_returned',
        'resolved',
        'cancelled',
        'expired',
      ],
    },
    cskhRespondedAt: { type: Date, default: null },
    cskhNote: { type: String, trim: true },
    returnTrackingNumber: { type: String, trim: true },
    returnDeadline: { type: Date, default: null }, // 10 days SLA
    kcsInspectedAt: { type: Date, default: null },
    kcsResult: {
      type: String,
      enum: ['pending', 'valid', 'invalid'],
      default: 'pending',
    },
    refundAmount: { type: Number, min: 0, default: 0 },
    refundMethod: {
      type: String,
      enum: ['wallet_balance', 'bank_transfer', 'member_points'],
      default: 'wallet_balance',
    },
    refundStatus: {
      type: String,
      enum: ['pending', 'completed', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

export const RentalDispute =
  mongoose.models.RentalDispute ||
  mongoose.model('RentalDispute', rentalDisputeSchema);
