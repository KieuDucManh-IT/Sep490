import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

export const configureCloudinary = () => {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
    secure: true,
  });

  return cloudinary;
};

// Khởi tạo config ngay khi module được nạp
configureCloudinary();

/**
 * Upload buffer lên Cloudinary
 * @param {Buffer} buffer - Buffer ảnh đã xử lý
 * @param {Object} options - { folder, public_id, resource_type, transformation, ... }
 * @param {string} [mimeType='image/webp']
 * @returns {Promise<Object>} Cloudinary upload response (secure_url, public_id, ...)
 */
export const uploadToCloudinary = (buffer, options = {}, mimeType = 'image/webp') => {
  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
    throw new Error('Chưa cấu hình đầy đủ biến môi trường Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)');
  }

  const resolvedMime = options?.mimeType || mimeType || 'image/webp';
  const dataUri = `data:${resolvedMime};base64,${buffer.toString('base64')}`;

  const uploadOptions = {
    resource_type: 'image',
    ...options,
  };
  delete uploadOptions.mimeType;

  return cloudinary.uploader.upload(dataUri, uploadOptions);
};

/**
 * Xoá ảnh trên Cloudinary theo public_id
 * @param {string} publicId
 * @param {string} resourceType
 */
export const deleteFromCloudinary = (publicId, resourceType = 'image') => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
};

export default cloudinary;