import express from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import multer from "multer";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { Product } from "../models/masterdata/Product.js";
import ProductImage from "../models/masterdata/ProductImages.js";
import { generateTryOn, detectGarmentCategory } from "../services/tryOnService.js";
import { authMiddleware } from "../middlewares/errorMiddleware.js";
import tryOnVideoRoutes from "./tryOnVideoRoutes.js";

const router = express.Router();

// ==========================================
// 1. VIDEO TRY-ON ROUTES (DECART AI)
// ==========================================
router.use("/videos", tryOnVideoRoutes);

const limiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Bạn đã mở nhiều phiên thử đồ. Hãy chờ một phút.",
  },
});

router.post("/token", authMiddleware, limiter, async (req, res) => {
  res.set("Cache-Control", "no-store");

  const apiKey = process.env.DECART_API_KEY?.trim();

  if (!apiKey) {
    return res.status(503).json({
      message: "Backend chưa có DECART_API_KEY.",
    });
  }

  try {
    // Dynamic import an toàn để server không bị crash nếu chưa cài package
    let createDecartClient;
    try {
      const decartModule = await import("@decartai/sdk");
      createDecartClient = decartModule.createDecartClient || decartModule.default?.createDecartClient;
    } catch (sdkErr) {
      console.warn("Chưa cài package @decartai/sdk trong backend:", sdkErr.message);
      return res.status(503).json({
        message: "Chưa cài đặt thư viện '@decartai/sdk' trong backend. Vui lòng chạy 'npm install' trong thư mục backend.",
      });
    }

    if (!createDecartClient) {
      return res.status(503).json({
        message: "Không khởi tạo được Decart client từ thư viện @decartai/sdk.",
      });
    }

    const client = createDecartClient({ apiKey });

    const token = await client.tokens.create({
      expiresIn: 120,
      allowedModels: ["lucy-vton-3.6"],
      allowedOrigins: (
        process.env.DECART_ALLOWED_ORIGINS || "http://localhost:3000"
      )
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      constraints: {
        realtime: {
          maxSessionDuration: 30,
        },
      },
    });

    return res.json({
      apiKey: token.apiKey,
      expiresAt: token.expiresAt,
    });
  } catch (error) {
    const secret = process.env.DECART_API_KEY?.trim();
    const originalMessage = String(
      error?.message || "Không có thông tin lỗi"
    );

    // Che API key nếu nhà cung cấp trả lại trong thông báo.
    const safeMessage = secret
      ? originalMessage.split(secret).join("[HIDDEN]")
      : originalMessage;

    console.error("DECART_TOKEN_ERROR", {
      code: error?.code || null,
      httpStatus: error?.data?.status ?? error?.status ?? null,
      message: safeMessage.slice(0, 1500),
      causeCode: error?.cause?.code || null,
    });

    return res.status(502).json({
      message:
        "Không tạo được phiên Decart. Xem DECART_TOKEN_ERROR trong terminal backend.",
    });
  }
});

// ==========================================
// 2. PHOTO TRY-ON ROUTES (IDM-VTON)
// ==========================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file định dạng ảnh (JPEG, PNG, WEBP)"));
    }
  },
});

// Danh sách người mẫu/mannequin mẫu có sẵn để khách trải nghiệm nhanh
const SAMPLE_MODELS = [
  {
    id: "female-s",
    label: "Nữ - Size S (1m65, 48kg)",
    gender: "female",
    size: "S",
    imageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "female-m",
    label: "Nữ - Size M (1m68, 54kg)",
    gender: "female",
    size: "M",
    imageUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "male-m",
    label: "Nam - Size M (1m75, 68kg)",
    gender: "male",
    size: "M",
    imageUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "male-l",
    label: "Nam - Size L (1m80, 75kg)",
    gender: "male",
    size: "L",
    imageUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
  },
];

/**
 * GET /api/try-on/sample-models
 * Lấy danh sách ảnh mẫu chuẩn có sẵn
 */
router.get("/sample-models", (req, res) => {
  return res.json({
    success: true,
    data: SAMPLE_MODELS,
  });
});

/**
 * POST /api/try-on/generate
 * Thực hiện ghép trang phục bằng AI IDM-VTON
 * Hỗ trợ cả đơn lẻ và combo 2 bước (Áo + Chân váy/Quần)
 */
router.post("/generate", upload.single("photo"), async (req, res, next) => {
  try {
    let humanImageUrl = req.body.humanImageUrl;

    // 1. Nếu người dùng upload ảnh trực tiếp
    if (req.file) {
      console.log("[TryOnRoutes] Đang tải ảnh người dùng lên Cloudinary...");
      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        { folder: "vestora/tryon/customers" },
        req.file.mimetype
      );
      humanImageUrl = uploadResult.secure_url;
    }

    if (!humanImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng tải ảnh toàn thân của bạn hoặc chọn ảnh mẫu có sẵn.",
      });
    }

    // 2. Tìm ảnh và thông tin trang phục
    let garmentImageUrl = req.body.garmentImageUrl;
    let garmentDescription = req.body.garmentDescription || "";
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
            const catStr = Array.isArray(product.category) ? product.category.join(" ") : "";
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
        console.warn("[TryOnRoutes] Lỗi tra cứu product:", prodErr.message);
      }
    }

    if (!garmentImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn trang phục hợp lệ để thử đồ.",
      });
    }

    // Nếu category vẫn chưa xác định, tự động phân loại theo mô tả
    if (!category) {
      category = detectGarmentCategory(garmentDescription, "");
    }

    const crop =
      req.body.crop === undefined || req.body.crop === ""
        ? true
        : req.body.crop === "true" || req.body.crop === true;

    // 3. Kiểm tra nếu có phối thêm chân váy / quần (Set cả bộ Áo + Váy/Quần)
    let bottomGarmentImageUrl = req.body.bottomGarmentImageUrl;
    let bottomGarmentDescription = req.body.bottomGarmentDescription || "";

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
        console.warn("[TryOnRoutes] Lỗi tra cứu bottomProduct:", err.message);
      }
    }

    if (bottomGarmentImageUrl && category === "upper_body") {
      console.log(
        `[TryOnRoutes] Thử set cả bộ 2 bước: Áo (${garmentDescription}) + Chân váy/Quần (${bottomGarmentDescription})`
      );

      // Bước 1: Thử áo thân trên
      const topResult = await generateTryOn({
        humanImageUrl,
        garmentImageUrl,
        category: "upper_body",
        garmentDescription,
        crop,
        steps: 30,
      });

      const intermediateImage = topResult.resultImageUrl;

      // Bước 2: Thử tiếp chân váy/quần vào ảnh đã mặc áo
      const fullSetResult = await generateTryOn({
        humanImageUrl: intermediateImage,
        garmentImageUrl: bottomGarmentImageUrl,
        category: "lower_body",
        garmentDescription: bottomGarmentDescription || "chân váy",
        crop: false,
        steps: 30,
      });

      return res.json({
        success: true,
        data: {
          resultImageUrl: fullSetResult.resultImageUrl,
          topImageUrl: intermediateImage,
          category: "combo_set",
          message: "Ghép thành công cả set bộ Áo và Chân váy/Quần",
        },
      });
    }

    // 4. Trường hợp thông thường: Ghép 1 món (Áo, Đầm, Quần hoặc Phụ kiện)
    const tryOnResult = await generateTryOn({
      humanImageUrl,
      garmentImageUrl,
      category,
      garmentDescription,
      crop,
      steps: 30,
    });

    return res.json({
      success: true,
      data: tryOnResult,
    });
  } catch (err) {
    console.error("[TryOnRoutes] Lỗi generate try-on:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Lỗi xử lý ghép đồ AI, vui lòng thử lại sau.",
    });
  }
});

export default router;
