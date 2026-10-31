import mongoose from 'mongoose';
import { Product } from '../../models/masterdata/Product.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { validateProduct } from '../../validations/masterdata/productValidation.js';

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
    return products.map((product) => {
      const images = byProduct.get(String(product._id));
      if (images?.length) return { ...product, images };
      const legacyImages = Array.isArray(product.images) ? product.images.filter((image) => typeof image === 'string' && image.trim()).map((imageUrl, index) => ({ imageUrl, imageType: index === 0 ? 'MAIN' : 'GALLERY', isPrimary: index === 0, displayOrder: index, variantId: null })) : [];
      return { ...product, images: legacyImages };
    });
  },
  create: async (payload) => {
    const { images, ...productPayload } = payload || {};
    const normalized = validateProduct(productPayload);
    const product = await Product.create(normalized);
    try {
      await saveImages(product._id, images || []);
    } catch (error) {
      await Promise.all([
        ProductImage.deleteMany({ productId: product._id }),
        Product.findByIdAndDelete(product._id),
      ]);
      throw error;
    }
    return withImages(await populateProduct(Product.findById(product._id)));
  },
  update: async (id, payload) => {
    const product = await Product.findById(id);
    if (!product) return null;
    const { images, ...productPayload } = payload || {};
    const current = product.toObject();
    delete current.productType;
    const changes = validateProduct(productPayload, current);
    Object.assign(product, changes);
    product.set('productType', undefined);
    await product.save();
    await saveImages(product._id, images);
    return withImages(await populateProduct(Product.findById(product._id)));
  },
  remove: async (id) => {
    const product = await Product.findByIdAndDelete(id);
    if (product) await ProductImage.deleteMany({ productId: product._id });
    return product;
  },
};
