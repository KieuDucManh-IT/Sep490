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

    // 3. Gọi AI IDM-VTON
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
