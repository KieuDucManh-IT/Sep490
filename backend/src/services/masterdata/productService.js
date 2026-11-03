import mongoose from 'mongoose';
import { Product } from '../../models/masterdata/Product.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { validateProduct } from '../../validations/masterdata/productValidation.js';
import { validateProductVariant } from '../../validations/masterdata/productVariantValidation.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InboundReceiptDetail } from '../../models/warehouse/inbound/InboundReceiptDetail.js';

const imageError = (message) => Object.assign(new Error(message), { statusCode: 400 });
const populateProduct = (query) => query.populate('categoryId').lean();

const normalizeImages = (images, productId) => {
  if (!Array.isArray(images)) throw imageError('Danh sách ảnh sản phẩm phải là một mảng.');
  const seenPrimary = new Set();
  return images.map((image, index) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) throw imageError(`Ảnh thứ ${index + 1} không hợp lệ.`);
    const imageUrl = typeof image.imageUrl === 'string' ? image.imageUrl.trim() : '';
    if (!imageUrl || imageUrl.length > 500 || !/^https?:\/\//i.test(imageUrl)) throw imageError(`Đường dẫn ảnh thứ ${index + 1} không hợp lệ.`);
    const imageType = String(image.imageType || 'GALLERY').trim().toUpperCase();
    if (!['MAIN', 'GALLERY', 'DETAIL'].includes(imageType)) throw imageError(`Loại ảnh thứ ${index + 1} không hợp lệ.`);
    const variantId = image.variantId || null;
    if (variantId && !mongoose.Types.ObjectId.isValid(variantId)) throw imageError(`Biến thể của ảnh thứ ${index + 1} không hợp lệ.`);
    const displayOrder = image.displayOrder == null ? index : Number(image.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) throw imageError(`Thứ tự ảnh thứ ${index + 1} phải là số nguyên không âm.`);
    const isPrimary = image.isPrimary === true;
    const primaryScope = String(variantId || 'product');
    if (isPrimary && seenPrimary.has(primaryScope)) throw imageError('Mỗi sản phẩm hoặc biến thể chỉ được có một ảnh chính.');
    if (isPrimary) seenPrimary.add(primaryScope);
    if (image._id && !mongoose.Types.ObjectId.isValid(image._id)) throw imageError(`Mã ảnh thứ ${index + 1} không hợp lệ.`);
    return {
      _id: image._id || undefined,
      productId,
      variantId,
      imageUrl,
      imageType,
      isPrimary,
      displayOrder,
    };
  });
};

const saveImages = async (productId, inputImages) => {
  if (inputImages === undefined) return;
  const images = normalizeImages(inputImages, productId);
  const ids = images.filter((image) => image._id).map((image) => image._id);
  const ownedImages = ids.length ? await ProductImage.countDocuments({ productId, _id: { $in: ids } }) : 0;
  if (ownedImages !== ids.length) throw imageError('Có ảnh không thuộc sản phẩm này hoặc đã bị xóa.');
  const variantIds = [...new Set(images.map((image) => image.variantId).filter(Boolean).map(String))];
  if (variantIds.length) {
    const ownedVariants = await ProductVariant.countDocuments({ productId, _id: { $in: variantIds } });
    if (ownedVariants !== variantIds.length) throw imageError('Biến thể gắn với ảnh không thuộc sản phẩm này.');
  }
  const keptIds = images.filter((image) => image._id).map((image) => image._id);
  await ProductImage.deleteMany({ productId, _id: { $nin: keptIds } });
  // Clear primary flags first to maintain the one-primary-per-product/variant rule.
  await ProductImage.updateMany({ productId }, { $set: { isPrimary: false } });
  for (const image of images) {
    if (image._id) {
      const existing = await ProductImage.findOne({ _id: image._id, productId });
      Object.assign(existing, image);
      await existing.save();
    } else {
      await ProductImage.create(image);
    }
  }
};

const withImages = async (product) => {
  if (!product) return product;
  let images = await ProductImage.find({ productId: product._id }).sort({ displayOrder: 1, createdAt: 1 }).lean();
  if (!images.length && Array.isArray(product.images)) {
    images = product.images.filter((image) => typeof image === 'string' && image.trim()).map((imageUrl, index) => ({
      imageUrl,
      imageType: index === 0 ? 'MAIN' : 'GALLERY',
      isPrimary: index === 0,
      displayOrder: index,
      variantId: null,
    }));
  }
  return { ...product, images };
};

const skuPart = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const buildVariantSku = async (productCode, variant, excludeId = null) => {
  const attributes = variant.attributes && typeof variant.attributes === 'object' ? Object.entries(variant.attributes).map(([key, value]) => `${key}-${value}`) : [];
  const descriptor = [variant.variantName, variant.color, variant.size, ...attributes].map(skuPart).filter(Boolean).join('-');
  if (!descriptor) throw imageError('Biến thể cần có tên, màu, kích thước hoặc thuộc tính để tạo SKU tự động.');
  const base = `${skuPart(productCode)}-${descriptor}`.slice(0, 90).replace(/-+$/g, '');
  let candidate = base;
  let suffix = 2;
  while (await ProductVariant.exists({ sku: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) candidate = `${base.slice(0, 94 - String(suffix).length)}-${suffix++}`;
  return candidate;
};

const syncProductVariants = async (productId, productCode, incoming) => {
  if (incoming === undefined) return;
  if (!Array.isArray(incoming)) throw imageError('Danh sách biến thể phải là một mảng.');
  const ids = incoming.filter((variant) => variant?._id).map((variant) => String(variant._id));
  if (new Set(ids).size !== ids.length) throw imageError('Biến thể bị lặp trong danh sách.');
  const existing = await ProductVariant.find({ productId });
  if (ids.some((id) => !existing.some((variant) => String(variant._id) === id))) throw imageError('Có biến thể không thuộc sản phẩm này.');
  for (const input of incoming) {
    const current = input._id ? existing.find((variant) => String(variant._id) === String(input._id)) : null;
    const variantInput = { ...input, productId };
    variantInput.sku = await buildVariantSku(productCode, variantInput, current?._id);
    const changes = validateProductVariant(variantInput, current?.toObject());
    if (current) { Object.assign(current, changes); await current.save(); }
    else await ProductVariant.create(changes);
  }
  // A list submitted by the editor is authoritative; protect variants that already have stock/history.
  const removedVariants = existing.filter((variant) => !ids.includes(String(variant._id)));
  for (const variant of removedVariants) {
    const referenced = await Promise.all([
      InventoryItem.exists({ variantId: variant._id }), InventoryBalance.exists({ variantId: variant._id }),
      InboundReceiptDetail.exists({ variantId: variant._id }), ProductImage.exists({ variantId: variant._id }),
    ]);
    if (referenced.some(Boolean)) throw imageError(`Không thể xóa biến thể ${variant.sku} vì đã phát sinh tồn kho hoặc phiếu nhập.`);
    await ProductVariant.findByIdAndDelete(variant._id);
  }
};

export const productService = {
  list: async () => {
    const products = await populateProduct(Product.find().select('-productType').sort({ createdAt: -1 }));
    const ids = products.map((product) => product._id);
    const images = await ProductImage.find({ productId: { $in: ids } }).sort({ displayOrder: 1 }).lean();
    const byProduct = new Map();
    for (const image of images) {
      const key = String(image.productId);
      byProduct.set(key, [...(byProduct.get(key) || []), image]);
    }
    const variants = await ProductVariant.find({ productId: { $in: ids } }).sort({ createdAt: 1 }).lean();
    const variantsByProduct = new Map();
    for (const variant of variants) variantsByProduct.set(String(variant.productId), [...(variantsByProduct.get(String(variant.productId)) || []), variant]);
    return products.map((product) => {
      const images = byProduct.get(String(product._id));
      if (images?.length) return { ...product, images, variants: variantsByProduct.get(String(product._id)) || [] };
      const legacyImages = Array.isArray(product.images) ? product.images.filter((image) => typeof image === 'string' && image.trim()).map((imageUrl, index) => ({ imageUrl, imageType: index === 0 ? 'MAIN' : 'GALLERY', isPrimary: index === 0, displayOrder: index, variantId: null })) : [];
      return { ...product, images: legacyImages, variants: variantsByProduct.get(String(product._id)) || [] };
    });
  },
  create: async (payload) => {
    const { images, variants, ...productPayload } = payload || {};
    const normalized = validateProduct(productPayload);
    const product = await Product.create(normalized);
    try {
      await saveImages(product._id, images || []);
      await syncProductVariants(product._id, product.productCode, variants || []);
    } catch (error) {
      await Promise.all([
        ProductImage.deleteMany({ productId: product._id }),
        Product.findByIdAndDelete(product._id),
        ProductVariant.deleteMany({ productId: product._id }),
      ]);
      throw error;
    }
    return withImages(await populateProduct(Product.findById(product._id)));
  },
  update: async (id, payload) => {
    const product = await Product.findById(id);
    if (!product) return null;
    const { images, variants, ...productPayload } = payload || {};
    const current = product.toObject();
    delete current.productType;
    const changes = validateProduct(productPayload, current);
    Object.assign(product, changes);
    product.set('productType', undefined);
    await product.save();
    await saveImages(product._id, images);
    await syncProductVariants(product._id, product.productCode, variants);
    return withImages(await populateProduct(Product.findById(product._id)));
  },
  remove: async (id) => {
    const product = await Product.findByIdAndDelete(id);
    if (product) await ProductImage.deleteMany({ productId: product._id });
    if (product) await ProductVariant.updateMany({ productId: product._id }, { $set: { status: 'inactive' } });
    return product;
  },
};
