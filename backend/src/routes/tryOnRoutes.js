import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { Product } from '../models/masterdata/Product.js';
import ProductImage from '../models/masterdata/ProductImages.js';
import { generateTryOn, detectGarmentCategory } from '../services/tryOnService.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file định dạng ảnh (JPEG, PNG, WEBP)'));
    }
  },
});

// Danh sách người mẫu/mannequin mẫu có sẵn để khách trải nghiệm nhanh
const SAMPLE_MODELS = [
  {
    id: 'female-s',
    label: 'Nữ - Size S (1m65, 48kg)',
    gender: 'female',
    size: 'S',
    imageUrl:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'female-m',
    label: 'Nữ - Size M (1m68, 54kg)',
    gender: 'female',
    size: 'M',
    imageUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'male-m',
    label: 'Nam - Size M (1m75, 68kg)',
    gender: 'male',
    size: 'M',
    imageUrl:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'male-l',
    label: 'Nam - Size L (1m80, 75kg)',
    gender: 'male',
    size: 'L',
    imageUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
  },
];

/**
 * GET /api/try-on/sample-models
 * Lấy danh sách ảnh mẫu chuẩn có sẵn
 */
router.get('/sample-models', (req, res) => {
  return res.json({
    success: true,
    data: SAMPLE_MODELS,
  });
});

/**
 * POST /api/try-on/generate
 * Thực hiện ghép trang phục bằng AI IDM-VTON
 */
router.post('/generate', upload.single('photo'), async (req, res, next) => {
  try {
    let humanImageUrl = req.body.humanImageUrl;

    // 1. Nếu người dùng upload ảnh trực tiếp
    if (req.file) {
      console.log('[TryOnRoutes] Đang tải ảnh người dùng lên Cloudinary...');
      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        { folder: 'vestora/tryon/customers' },
        req.file.mimetype
      );
      humanImageUrl = uploadResult.secure_url;
    }

    if (!humanImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải ảnh toàn thân của bạn hoặc chọn ảnh mẫu có sẵn.',
      });
    }

    // 2. Tìm ảnh và thông tin trang phục
    let garmentImageUrl = req.body.garmentImageUrl;
    let garmentDescription = req.body.garmentDescription || '';
    let category = req.body.category;

    if (req.body.productId) {
      try {
        let product = null;
        if (mongoose.Types.ObjectId.isValid(req.body.productId)) {
          product = await Product.findById(req.body.productId).lean();
        }
        if (!product) {
          product = await Product.findOne({ productCode: req.body.productId }).lean();
        }
        if (product) {
          if (!garmentDescription) {
            garmentDescription = product.name;
          }

          if (!category) {
            const catStr = Array.isArray(product.category) ? product.category.join(' ') : '';
            category = detectGarmentCategory(product.name, catStr);
          }

          // Lấy ảnh trang phục từ database nếu frontend chưa truyền
          if (!garmentImageUrl) {
            const primaryImage = await ProductImage.findOne({
              productId: product._id,
              isPrimary: true,
            }).lean();

            if (primaryImage?.imageUrl) {
              garmentImageUrl = primaryImage.imageUrl;
            } else {
              const anyImage = await ProductImage.findOne({
                productId: product._id,
              }).lean();
              garmentImageUrl =
                anyImage?.imageUrl ||
                (Array.isArray(product.images) && product.images[0]) ||
                product.image;
            }
          }
        }
      } catch (prodErr) {
        console.warn('[TryOnRoutes] Lỗi tra cứu product:', prodErr.message);
      }
    }

    if (!garmentImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn trang phục hợp lệ để thử đồ.',
      });
    }

    // Nếu category vẫn chưa xác định, tự động phân loại theo mô tả
    if (!category) {
      category = detectGarmentCategory(garmentDescription, '');
    }

    const crop =
      req.body.crop === undefined || req.body.crop === ''
        ? true
        : req.body.crop === 'true' || req.body.crop === true;

    // 3. Kiểm tra nếu có phối thêm chân váy / quần (Set cả bộ Áo + Váy/Quần)
    let bottomGarmentImageUrl = req.body.bottomGarmentImageUrl;
    let bottomGarmentDescription = req.body.bottomGarmentDescription || '';

    if (req.body.bottomProductId && !bottomGarmentImageUrl) {
      try {
        let bottomProd = null;
        if (mongoose.Types.ObjectId.isValid(req.body.bottomProductId)) {
          bottomProd = await Product.findById(req.body.bottomProductId).lean();
        }
        if (!bottomProd) {
          bottomProd = await Product.findOne({ productCode: req.body.bottomProductId }).lean();
        }
        if (bottomProd) {
          bottomGarmentDescription = bottomGarmentDescription || bottomProd.name;
          bottomGarmentImageUrl =
            (Array.isArray(bottomProd.images) && bottomProd.images[0]) ||
            bottomProd.image;
        }
      } catch (err) {
        console.warn('[TryOnRoutes] Lỗi tra cứu bottomProduct:', err.message);
      }
    }

    if (bottomGarmentImageUrl && category === 'upper_body') {
      console.log(
        `[TryOnRoutes] Thử set cả bộ 2 bước: Áo (${garmentDescription}) + Chân váy/Quần (${bottomGarmentDescription})`
      );

      // Bước 1: Thử áo thân trên
      const topResult = await generateTryOn({
        humanImageUrl,
        garmentImageUrl,
        category: 'upper_body',
        garmentDescription,
        crop,
        steps: 30,
      });

      const intermediateImage = topResult?.resultImageUrl;

      if (!intermediateImage) {
        throw new Error('Bước 1 (thử áo thân trên) không trả về kết quả ảnh');
      }

      // Bước 2: Thử chân váy/quần thân dưới lên ảnh đã có áo
      const finalResult = await generateTryOn({
        humanImageUrl: intermediateImage,
        garmentImageUrl: bottomGarmentImageUrl,
        category: 'lower_body',
        garmentDescription: bottomGarmentDescription || 'skirt or trousers',
        crop: false, // Giữ nguyên kích thước ảnh bước 1
        steps: 30,
      });

      return res.json({
        success: true,
        data: finalResult,
      });
    }

    // 4. Gọi AI IDM-VTON cho 1 món đơn lẻ
    const tryOnResult = await generateTryOn({
      humanImageUrl,
      garmentImageUrl,
      category,
      garmentDescription,
      crop,
      steps: 35,
    });

    return res.json({
      success: true,
      data: tryOnResult,
    });
  } catch (err) {
    console.error('[TryOnRoutes] Lỗi generate try-on:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Lỗi xử lý ghép đồ AI, vui lòng thử lại sau.',
    });
  }
});

export default router;
