import mongoose from 'mongoose';
import { Product } from '../../models/masterdata/Product.js';
import { Category } from '../../models/masterdata/Category.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { validateProduct } from '../../validations/masterdata/productValidation.js';
import { validateProductVariant } from '../../validations/masterdata/productVariantValidation.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InboundReceiptDetail } from '../../models/warehouse/inbound/InboundReceiptDetail.js';
import { enrichProductsWithInventory } from '../warehouse/productInventoryHelper.js';
import { normalizeColorKey } from './productImageHelper.js';
import { hasRequiredPrices } from './productPricing.js';
import { assertLeafCategories } from './categoryRules.js';

const imageError = (message) => Object.assign(new Error(message), { statusCode: 400 });
const populateProduct = (query) => query.populate('categoryId').lean();
const assertActiveCategories = async (categoryIds) => {
  const ids = [...new Set((categoryIds || []).map(String))];
  if (ids.length && await Category.countDocuments({ _id: { $in: ids }, isDeleted: { $ne: true }, status: 'active' }) !== ids.length) {
    throw imageError('Một hoặc nhiều loại sản phẩm không tồn tại hoặc đã ngừng hoạt động.');
  }
};

/**
 * Sản phẩm chỉ gắn loại cấp cuối (TASK-014 A3). Chỉ kiểm các loại mới thêm so với `currentIds`:
 * sản phẩm cũ đang gắn loại cha (dữ liệu trước khi đổi quy tắc) vẫn sửa được các trường khác.
 */
const assertLeafCategoriesForNew = async (categoryIds, currentIds = []) => {
  const current = new Set((currentIds || []).map((id) => String(id?._id || id)));
  const added = [...new Set((categoryIds || []).map(String))].filter((id) => !current.has(id));
  if (!added.length) return;
  const parentIds = await Category.distinct('parentCategoryId', {
    parentCategoryId: { $in: added }, isDeleted: { $ne: true }, status: 'active',
  });
  assertLeafCategories(added, parentIds);
};

const normalizeImages =(images, productId) => {
  if (!Array.isArray(images)) throw imageError('Danh sách ảnh sản phẩm phải là một mảng.');
  const seenPrimary = new Set();
  return images.map((image, index) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) throw imageError(`Ảnh thứ ${index + 1} không hợp lệ.`);
    const imageUrl = typeof image.imageUrl === 'string' ? image.imageUrl.trim() : '';
    if (!imageUrl || imageUrl.length > 500 || !/^https?:\/\//i.test(imageUrl)) throw imageError(`Đường dẫn ảnh thứ ${index + 1} không hợp lệ.`);
    const imageType = String(image.imageType || 'GALLERY').trim().toUpperCase();
    if (!['MAIN', 'GALLERY', 'DETAIL'].includes(imageType)) throw imageError(`Loại ảnh thứ ${index + 1} không hợp lệ.`);
    // Payload cũ có thể còn variantId: bỏ qua (TASK-007), ảnh gắn theo màu.
    if (image.color != null && typeof image.color !== 'string') throw imageError(`Màu của ảnh thứ ${index + 1} không hợp lệ.`);
    const color = typeof image.color === 'string' && image.color.trim() ? image.color.trim() : null;
    if (color && color.length > 80) throw imageError(`Màu của ảnh thứ ${index + 1} quá dài.`);
    const displayOrder = image.displayOrder == null ? index : Number(image.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) throw imageError(`Thứ tự ảnh thứ ${index + 1} phải là số nguyên không âm.`);
    const isPrimary = image.isPrimary === true;
    const primaryScope = color ? `color:${normalizeColorKey(color)}` : 'product';
    if (isPrimary && seenPrimary.has(primaryScope)) {
      throw imageError(color ? `Màu "${color}" chỉ được có một ảnh chính.` : 'Ảnh chung của sản phẩm chỉ được có một ảnh chính.');
    }
    if (isPrimary) seenPrimary.add(primaryScope);
    if (image._id && !mongoose.Types.ObjectId.isValid(image._id)) throw imageError(`Mã ảnh thứ ${index + 1} không hợp lệ.`);
    return {
      _id: image._id || undefined,
      productId,
      color,
      imageUrl,
      imageType,
      isPrimary,
      displayOrder,
      position: index + 1,
    };
  });
};

const saveImages = async (productId, inputImages) => {
  if (inputImages === undefined) return;
  const images = normalizeImages(inputImages, productId);
  const ids = images.filter((image) => image._id).map((image) => String(image._id));
  const ownedImages = ids.length ? await ProductImage.find({ productId, _id: { $in: ids } }).select('_id color').lean() : [];
  if (ownedImages.length !== new Set(ids).size) throw imageError('Có ảnh không thuộc sản phẩm này hoặc đã bị xóa.');
  const storedColorById = new Map(ownedImages.map((image) => [String(image._id), normalizeColorKey(image.color)]));
  if (images.some((image) => image.color)) {
    // Màu hợp lệ = màu của biến thể chưa xóa; lưu theo cách viết của biến thể đầu tiên có màu đó.
    const variants = await ProductVariant.find({ productId, isDeleted: { $ne: true } }).select('color').sort({ createdAt: 1, _id: 1 }).lean();
    const canonicalColor = new Map();
    for (const variant of variants) {
      const key = normalizeColorKey(variant.color);
      if (key && !canonicalColor.has(key)) canonicalColor.set(key, String(variant.color).trim());
    }
    for (const image of images) {
      if (!image.color) continue;
      const key = normalizeColorKey(image.color);
      if (canonicalColor.has(key)) { image.color = canonicalColor.get(key); continue; }
      // Ảnh cũ giữ nguyên màu đã lưu (màu không còn biến thể) vẫn được lưu lại, chỉ ẩn với khách.
      if (image._id && storedColorById.get(String(image._id)) === key) continue;
      throw imageError(`Màu của ảnh thứ ${image.position} không thuộc sản phẩm này.`);
    }
  }
  await ProductImage.deleteMany({ productId, _id: { $nin: ids } });
  // Clear primary flags first to maintain the one-primary-per-scope (product/color) rule.
  await ProductImage.updateMany({ productId }, { $set: { isPrimary: false } });
  for (const { position, ...image } of images) {
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
      color: null,
    }));
  }
  return { ...product, images };
};

const skuPart = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const buildVariantSku = async (productCode, variant, excludeId = null) => {
  const attributes = variant.attributes && typeof variant.attributes === 'object' ? Object.entries(variant.attributes).map(([key, value]) => `${key}-${value}`) : [];
const descriptor = [variant.color, variant.size, ...attributes].map(skuPart).filter(Boolean).join('-');
if (!descriptor) throw imageError('Biến thể cần có màu sắc, kích thước hoặc thuộc tính để tạo SKU tự động.');
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
  const existing = await ProductVariant.find({ productId, isDeleted: { $ne: true } });
  if (ids.some((id) => !existing.some((variant) => String(variant._id) === id))) throw imageError('Có biến thể không thuộc sản phẩm này.');
  for (const input of incoming) {
    const current = input._id ? existing.find((variant) => String(variant._id) === String(input._id)) : null;
    const variantInput = { ...input };
    delete variantInput._id;
    variantInput.productId = productId;
    delete variantInput.variantName;
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
      InboundReceiptDetail.exists({ variantId: variant._id }),
    ]);
    if (referenced.some(Boolean)) throw imageError(`Không thể xóa biến thể ${variant.sku} vì đã phát sinh tồn kho hoặc phiếu nhập.`);
    variant.isDeleted = true;
    variant.status = 'inactive';
    await variant.save();
  }
};

export const productService = {
  list: async () => {
    const products = await populateProduct(Product.find({ isDeleted: { $ne: true } }).select('-productType').populate('shopId').sort({ createdAt: -1 }));
    const ids = products.map((product) => product._id);
    const images = await ProductImage.find({ productId: { $in: ids } }).sort({ displayOrder: 1 }).lean();
    const byProduct = new Map();
    for (const image of images) {
      const key = String(image.productId);
      byProduct.set(key, [...(byProduct.get(key) || []), image]);
    }
    const variants = await ProductVariant.find({ productId: { $in: ids }, isDeleted: { $ne: true } }).select('-variantName').sort({ createdAt: 1 }).lean();
    const variantsByProduct = new Map();
    for (const variant of variants) variantsByProduct.set(String(variant.productId), [...(variantsByProduct.get(String(variant.productId)) || []), variant]);
    const mapped = products.map((product) => {
      const images = byProduct.get(String(product._id));
      if (images?.length) return { ...product, images, variants: variantsByProduct.get(String(product._id)) || [] };
      const legacyImages = Array.isArray(product.images) ? product.images.filter((image) => typeof image === 'string' && image.trim()).map((imageUrl, index) => ({ imageUrl, imageType: index === 0 ? 'MAIN' : 'GALLERY', isPrimary: index === 0, displayOrder: index, color: null })) : [];
      return { ...product, images: legacyImages, variants: variantsByProduct.get(String(product._id)) || [] };
    });
    return enrichProductsWithInventory(mapped, variants);
  },
  create: async (payload) => {
    const { images, variants, ...productPayload } = payload || {};
    const normalized = validateProduct(productPayload);
    await assertActiveCategories(normalized.categoryId);
    await assertLeafCategoriesForNew(normalized.categoryId);
    const product = await Product.create(normalized);
    try {
      // Biến thể trước, ảnh sau: màu của ảnh được kiểm tra theo biến thể vừa lưu.
      await syncProductVariants(product._id, product.productCode, variants || []);
      await saveImages(product._id, images || []);
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
    await assertActiveCategories(changes.categoryId || product.categoryId);
    if (changes.categoryId) await assertLeafCategoriesForNew(changes.categoryId, product.categoryId);
    Object.assign(product, changes);
    product.set('productType', undefined);
    // TASK-008: WM đổi tag của sản phẩm đã định giá mà giá không còn đủ → tạm ẩn với khách tới khi Owner bổ sung.
    // Không tự bật lại isSetPrice: chỉ Shop Owner mở bán qua API định giá.
    if (product.isSetPrice === true && !hasRequiredPrices(product)) product.isSetPrice = false;
    await product.save();
    await syncProductVariants(product._id, product.productCode, variants);
    await saveImages(product._id, images);
    if (current.productCode !== product.productCode) {
      const productVariants = await ProductVariant.find({ productId: product._id, isDeleted: { $ne: true } });
      for (const variant of productVariants) {
        variant.sku = await buildVariantSku(product.productCode, variant.toObject(), variant._id);
        await variant.save();
      }
    }
    return withImages(await populateProduct(Product.findById(product._id)));
  },
  remove: async (id) => {
    const product = await Product.findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { $set: { isDeleted: true, status: 'inactive' } }, { new: true });
    if (product) await ProductImage.deleteMany({ productId: product._id });
    if (product) await ProductVariant.updateMany({ productId: product._id }, { $set: { status: 'inactive', isDeleted: true } });
    return product;
  },
};
