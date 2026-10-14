import mongoose from 'mongoose';

const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  taxCode: { type: String, default: '' },
  address: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  businessLicenseUrl: { type: String, default: '' },
  idCardFrontUrl: { type: String, default: '' },
  idCardBackUrl: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['PENDING', 'ACTIVE', 'REJECTED', 'LOCKED'], 
    default: 'PENDING' 
  },
  rejectionReason: { type: String, default: '' },
  notes: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { 
  timestamps: true,
  collection: 'shops' // Map explicitly to existing 'shops' collection in MongoDB
});

export const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);
