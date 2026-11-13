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

    // 3. Chuỗi các món trang phục phối thêm (Quần/Chân váy, Áo, Blazer)
    const additionalClothing = [];

    // 3.1. Món trang phục phối kèm (Quần / Chân váy nếu chọn Áo, hoặc Áo / Blazer nếu chọn Quần)
    let pairedGarmentImageUrl =
      req.body.pairedGarmentImageUrl || req.body.bottomGarmentImageUrl;
    let pairedGarmentDescription =
      req.body.pairedGarmentDescription || req.body.bottomGarmentDescription || "";
    let pairedGarmentCategory =
      req.body.pairedGarmentCategory ||
      (category === "upper_body" ? "lower_body" : category === "lower_body" ? "upper_body" : "upper_body");

    const pairedId = req.body.pairedGarmentId || req.body.bottomProductId;
    if (pairedId && !pairedGarmentImageUrl) {
      try {
        let pairedProd = null;
        if (mongoose.Types.ObjectId.isValid(pairedId)) {
          pairedProd = await Product.findById(pairedId).lean();
        }
        if (!pairedProd) {
          pairedProd = await Product.findOne({ productCode: pairedId }).lean();
        }
        if (pairedProd) {
          pairedGarmentDescription = pairedGarmentDescription || pairedProd.name;
          pairedGarmentImageUrl =
            (Array.isArray(pairedProd.images) && pairedProd.images[0]) ||
            pairedProd.image;
        }
      } catch (err) {
        console.warn("[TryOnRoutes] Lỗi tra cứu pairedGarment:", err.message);
      }
    }

    // Chỉ đưa vào AI IDM-VTON các món QUẦN ÁO thực sự (upper_body, lower_body, dresses)
    if (pairedGarmentImageUrl && pairedGarmentCategory !== "accessories") {
      additionalClothing.push({
        garmentImageUrl: pairedGarmentImageUrl,
        category: pairedGarmentCategory,
        garmentDescription: pairedGarmentDescription || "trang phục phối cùng",
      });
    }

    // 3.2. Món phụ kiện phối kèm (Túi xách, Trang sức, Kính mắt, Khăn...)
    // CHÚ Ý KỸ THUẬT QUAN TRỌNG:
    // Mô hình AI IDM-VTON chỉ học cấu trúc giải phẫu của QUẦN ÁO (upper_body, lower_body, dresses).
    // Tuyệt đối KHÔNG đưa túi xách vào IDM-VTON vì AI sẽ coi túi xách là ÁO THÂN TRÊN và mặc lên ngực người mẫu!
    // Phụ kiện được quản lý như một món Styling Accessories đi kèm trong Set Lookbook.
    let accessoryGarmentImageUrl = req.body.accessoryGarmentImageUrl;
    let accessoryGarmentDescription = req.body.accessoryGarmentDescription || "";

    const accId = req.body.accessoryGarmentId;
    if (accId && !accessoryGarmentImageUrl) {
      try {
        let accProd = null;
        if (mongoose.Types.ObjectId.isValid(accId)) {
          accProd = await Product.findById(accId).lean();
        }
        if (!accProd) {
          accProd = await Product.findOne({ productCode: accId }).lean();
        }
        if (accProd) {
          accessoryGarmentDescription = accessoryGarmentDescription || accProd.name;
          accessoryGarmentImageUrl =
            (Array.isArray(accProd.images) && accProd.images[0]) ||
            accProd.image;
        }
      } catch (err) {
        console.warn("[TryOnRoutes] Lỗi tra cứu accessoryGarment:", err.message);
      }
    }

    // Nếu sản phẩm chính lại là Phụ kiện (túi xách/kính):
    if (category === "accessories") {
      return res.status(400).json({
        success: false,
        message:
          "Túi xách và phụ kiện là món phối kèm theo set đồ (Complete The Look). Vui lòng chọn trang phục chính (Đầm, Áo, hoặc Chân váy/Quần) để AI ướm thử phom dáng lên người mẫu!",
      });
    }

    // 4. Nếu có món trang phục phối thêm (Áo + Váy/Quần) -> Ghép tuần tự bằng AI IDM-VTON
    if (additionalClothing.length > 0) {
      console.log(
        `[TryOnRoutes] Ghép set trang phục 2 bước bằng IDM-VTON: Món chính (${garmentDescription}) + ${additionalClothing
          .map((g) => g.garmentDescription)
          .join(" + ")}`
      );

      // Bước 1: Ghép món chính đầu tiên
      const step1Result = await generateTryOn({
        humanImageUrl,
        garmentImageUrl,
        category,
        garmentDescription,
        crop,
        steps: 30,
      });

      let currentModelImage = step1Result.resultImageUrl;
      const intermediateImages = [step1Result.resultImageUrl];

      // Bước 2: Ghép tiếp món trang phục phối kèm (quần/chân váy) vào người mẫu đã mặc món 1
      for (let i = 0; i < additionalClothing.length; i++) {
        const item = additionalClothing[i];
        console.log(
          `[TryOnRoutes] Đang ghép trang phục phối thứ ${i + 2}: ${item.garmentDescription} (${item.category})...`
        );
        const nextResult = await generateTryOn({
          humanImageUrl: currentModelImage,
          garmentImageUrl: item.garmentImageUrl,
          category: item.category,
          garmentDescription: item.garmentDescription,
          crop: false,
          steps: 30,
        });

        currentModelImage = nextResult.resultImageUrl;
        intermediateImages.push(currentModelImage);
      }

      return res.json({
        success: true,
        data: {
          resultImageUrl: currentModelImage,
          intermediateImages,
          category: "combo_set",
          totalItems: 1 + additionalClothing.length + (accessoryGarmentImageUrl ? 1 : 0),
          accessory: accessoryGarmentImageUrl
            ? {
                imageUrl: accessoryGarmentImageUrl,
                name: accessoryGarmentDescription,
              }
            : null,
          message: accessoryGarmentImageUrl
            ? "Ghép thành công set trang phục hoàn chỉnh kèm phụ kiện túi xách trong Lookbook!"
            : `Ghép thành công cả set bộ ${1 + additionalClothing.length} món!`,
        },
      });
    }

    // 5. Trường hợp ghép 1 món trang phục đơn lẻ thông thường
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
      data: {
        ...tryOnResult,
        accessory: accessoryGarmentImageUrl
          ? {
              imageUrl: accessoryGarmentImageUrl,
              name: accessoryGarmentDescription,
            }
          : null,
      },
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
