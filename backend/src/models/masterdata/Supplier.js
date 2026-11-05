import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  supplierCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  contactName: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  taxCode: { type: String, trim: true },
  address: { type: String, trim: true },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
}, { timestamps: true });

export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);
