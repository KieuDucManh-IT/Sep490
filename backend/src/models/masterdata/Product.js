import mongoose from 'mongoose';
import './Category.js';
import '../shop/Shop.js';

const productSchema = new mongoose.Schema({
  categoryId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }],
  category: [{ type: String }],
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
  productCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  tag: { type: String, enum: ['sale', 'rental', 'both'] },
  // TASK-015: bỏ `trackingType` — mọi sản phẩm quản lý theo từng món (InventoryItem). Dữ liệu cũ gỡ bằng
  // `migrateQuantityToItems.js --unset-field --apply`.
  brand: { type: String, trim: true },
  material: { type: String, trim: true },
  rating: { type: Number, default: 5.0, min: 0, max: 5 },
  reviewsCount: { type: Number, default: 50 },
  rentalPricePerDay: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  deposit: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  aiTryOn: { type: Boolean, default: true },
  status: { type: String, default: 'active', enum: ['active', 'inactive', 'discontinued'] },
  isDeleted: { type: Boolean, default: false },
  gender: { type: String, trim: true },
  // TASK-008: chỉ hiện cho khách sau khi Shop Owner định giá (PATCH /api/products/:id/pricing).
  isSetPrice: { type: Boolean, default: false, index: true },
  priceSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  priceSetAt: { type: Date, default: null },
  isOutOfStock: { type: Boolean, default: false, index: true },
  outOfStockAt: { type: Date, default: null },      // thời điểm bị đánh dấu hết hàng
  restockRequestedAt: { type: Date, default: null }, // thời điểm branch_manager tạo phiếu nhập → hiển thị lại

}, { timestamps: true, strict: false });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
