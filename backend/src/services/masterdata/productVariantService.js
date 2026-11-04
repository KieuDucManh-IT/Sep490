import mongoose from 'mongoose';
import { Product } from '../../models/masterdata/Product.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InboundReceiptDetail } from '../../models/warehouse/inbound/InboundReceiptDetail.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { validateProductVariant } from '../../validations/masterdata/productVariantValidation.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const skuPart = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

const buildSku = async (product, variant, excludeId = null) => {
  const attributes = variant.attributes && typeof variant.attributes === 'object'
    ? Object.entries(variant.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}-${value}`)
    : [];
  const descriptor = [variant.color, variant.size, ...attributes].map(skuPart).filter(Boolean).join('-');
  if (!descriptor) throw fail('Biến thể cần có màu sắc, kích thước hoặc thuộc tính để tạo SKU.');
  const base = `${skuPart(product.productCode)}-${descriptor}`.slice(0, 90).replace(/-+$/g, '');
  let candidate = base;
  let suffix = 2;
  while (await ProductVariant.exists({ sku: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    candidate = `${base.slice(0, 94 - String(suffix).length)}-${suffix++}`;
  }
  return candidate;
};

const validateProductOwnership = async (productId) => {
  if (!mongoose.isValidObjectId(productId)) throw fail('Sản phẩm không hợp lệ.');
  const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } }).select('productCode status').lean();
  if (!product || product.status !== 'active') throw fail('Sản phẩm không tồn tại hoặc đã ngừng hoạt động.');
  return product;
};

const referenced = async (variantId) => Promise.all([
  InventoryItem.exists({ variantId }), InventoryBalance.exists({ variantId }),
  InboundReceiptDetail.exists({ variantId }), ProductImage.exists({ variantId }),
  SalesOrderDetail.exists({ variantId }), RentalOrderDetail.exists({ variantId }),
]);

export const productVariantService = {
  list: () => ProductVariant.find({ isDeleted: { $ne: true } }).populate('productId', 'productCode name').sort({ createdAt: -1 }),
  create: async (payload) => {
    const product = await validateProductOwnership(payload?.productId);
    const data = validateProductVariant({ ...payload, sku: 'pending' });
    data.sku = await buildSku(product, data);
    return ProductVariant.create(data);
  },
  update: async (id, payload) => {
    const variant = await ProductVariant.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!variant) return null;
    const productId = payload?.productId || variant.productId;
    if (String(productId) !== String(variant.productId) && (await referenced(variant._id)).some(Boolean)) {
      throw fail('Không thể chuyển biến thể sang sản phẩm khác vì đã phát sinh tồn kho hoặc lịch sử nhập hàng.');
    }
    const product = await validateProductOwnership(productId);
    const input = { ...payload, productId };
    delete input.sku;
    const data = validateProductVariant(input, variant.toObject());
    data.sku = await buildSku(product, data, variant._id);
    Object.assign(variant, data);
    return variant.save();
  },
  remove: async (id) => {
    const variant = await ProductVariant.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!variant) return null;
    variant.isDeleted = true;
    variant.status = 'inactive';
    return variant.save();
  },
};
