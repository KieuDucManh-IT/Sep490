import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { uploadToCloudinary } from '../../config/cloudinary.js';
import { validationError } from '../../validations/shop/shopValidation.js';

/**
 * Xử lý tối ưu hóa hình ảnh gian hàng (Logo chi nhánh hoặc Ảnh bìa cửa hàng):
 * 1. Kiểm tra kích thước và định dạng file (tối đa 10MB).
 * 2. Nén và định cỡ bằng Sharp (WebP chất lượng 85%):
 *    - Logo chi nhánh (avatar): 512x512 pixels (fit cover).
 *    - Ảnh bìa cửa hàng (banner): 1920x1080 pixels (fit inside).
 * 3. Tải lên dịch vụ lưu trữ đám mây Cloudinary.
 * 4. Tự động dự phòng lưu cục bộ (Local fallback) nếu Cloudinary mất kết nối mạng.
 *
 * @param {object} params
 * @param {object} params.file - Đối tượng file từ Multer (có buffer và mimetype)
 * @param {string} params.imageType - Loại ảnh: 'avatar' | 'banner'
 * @param {string} params.host - Host name của ứng dụng (để sinh URL local nếu cần)
 * @param {string} params.protocol - Protocol http hoặc https
 * @returns {Promise<{ url: string, public_id?: string, message: string }>}
 */
export const processAndUploadShopMedia = async ({ file, imageType = 'avatar', host = 'localhost:5001', protocol = 'http' }) => {
  if (!file || !file.buffer) {
    throw validationError('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WEBP).', 400);
  }

  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.buffer.length > maxSizeBytes) {
    throw validationError('Dung lượng ảnh vượt quá giới hạn 10MB.', 413);
  }

  const normalizedType = imageType === 'banner' ? 'banner' : 'avatar';
  let processedBuffer = file.buffer;
  let uploadMimeType = file.mimetype || 'image/jpeg';

  // 1. Tối ưu nén ảnh bằng Sharp
  try {
    if (normalizedType === 'avatar') {
      processedBuffer = await sharp(file.buffer)
        .rotate()
        .resize(512, 512, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();
    } else {
      processedBuffer = await sharp(file.buffer)
        .rotate()
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    }
    uploadMimeType = 'image/webp';
  } catch (sharpError) {
    console.warn('[processAndUploadShopMedia] Sharp optimization warning, using original buffer:', sharpError.message);
    processedBuffer = file.buffer;
  }

  // 2. Tải lên Cloudinary
  try {
    const uploadResult = await uploadToCloudinary(
      processedBuffer,
      {
        folder: `vestora/shops/${normalizedType}`,
        public_id: `${Date.now()}-${crypto.randomUUID()}`,
      },
      uploadMimeType
    );

    return {
      success: true,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      message: 'Tải ảnh lên thành công!',
    };
  } catch (cloudError) {
    console.warn('[processAndUploadShopMedia] Cloudinary upload unavailable, falling back to local uploads:', cloudError.message);

    // 3. Fallback: Lưu vào thư mục máy chủ cục bộ khi Cloudinary không sẵn sàng
    try {
      const uploadDir = path.join(process.cwd(), 'uploads', 'shops', normalizedType);
      await fs.promises.mkdir(uploadDir, { recursive: true });

      const fileExtension = uploadMimeType === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.promises.writeFile(filePath, processedBuffer);

      const localUrl = `${protocol}://${host}/uploads/shops/${normalizedType}/${fileName}`;

      return {
        success: true,
        url: localUrl,
        message: 'Tải ảnh lên máy chủ thành công!',
      };
    } catch (localError) {
      console.error('[processAndUploadShopMedia] Local storage save also failed:', localError.message);
      throw validationError(
        cloudError.message || 'Không thể tải ảnh lên dịch vụ lưu trữ. Vui lòng thử lại sau.',
        502
      );
    }
  }
};
