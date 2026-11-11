import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";

import cloudinary from "../config/cloudinary.js";
import { authMiddleware } from "../middlewares/errorMiddleware.js";
import { Product } from "../models/masterdata/Product.js";
import TryOnVideo from "../models/customer/TryOnVideo.js";

const router = express.Router();
const MAX_BYTES = 20 * 1024 * 1024;

const objectIdPattern = /^[a-f0-9]{24}$/i;
const recordingIdPattern =
  /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function fail(status, message) {
  return Object.assign(new Error(message), {
    status,
    expose: true,
  });
}

const receiveVideo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BYTES,
    files: 1,
    fields: 2,
    parts: 3,
    fieldSize: 100,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = ["video/webm", "video/mp4"];

    if (!allowed.includes(file.mimetype)) {
      return callback(
        fail(400, "Chỉ hỗ trợ video WebM hoặc MP4.")
      );
    }

    callback(null, true);
  },
}).single("video");

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Bạn đã lưu nhiều video. Hãy thử lại sau một phút.",
  },
});

router.use(authMiddleware);

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");

  const config = cloudinary.config();

  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    return res.status(503).json({
      message: "Backend chưa cấu hình Cloudinary đầy đủ.",
    });
  }

  next();
});

function toClient(video) {
  return {
    id: String(video._id),
    productId: String(video.productId),
    duration: video.duration,
    createdAt: video.createdAt,

    // Cấp lại URL khi người dùng tải danh sách.
    url: cloudinary.utils.private_download_url(
      video.publicId,
      video.format,
      {
        resource_type: "video",
        type: "authenticated",
        attachment: false,
        expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
      }
    ),
  };
}

// GET /api/try-on/videos?productId=...
router.get("/", async (req, res) => {
  const { productId } = req.query;

  if (
    typeof productId !== "string" ||
    !objectIdPattern.test(productId)
  ) {
    return res.status(400).json({
      message: "Mã sản phẩm không hợp lệ.",
    });
  }

  try {
    const videos = await TryOnVideo.find({
      userId: req.user._id,
      productId,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({
      data: videos.map(toClient),
    });
  } catch {
    return res.status(500).json({
      message: "Không tải được danh sách video.",
    });
  }
});

// POST /api/try-on/videos
router.post(
  "/",
  uploadLimiter,
  receiveVideo,
  async (req, res) => {
    let uploaded = null;
    let saved = null;
    let key = null;

    try {
      const { productId, recordingId } = req.body;

      if (
        typeof productId !== "string" ||
        !objectIdPattern.test(productId)
      ) {
        throw fail(400, "Mã sản phẩm không hợp lệ.");
      }

      if (
        typeof recordingId !== "string" ||
        !recordingIdPattern.test(recordingId)
      ) {
        throw fail(400, "Mã bản ghi không hợp lệ.");
      }

      if (!req.file?.buffer?.length) {
        throw fail(400, "Chưa nhận được video.");
      }

      const buffer = req.file.buffer;

      const isWebM =
        req.file.mimetype === "video/webm" &&
        buffer.subarray(0, 4).toString("hex") === "1a45dfa3";

      const isMP4 =
        req.file.mimetype === "video/mp4" &&
        buffer.subarray(4, 8).toString("ascii") === "ftyp";

      if (!isWebM && !isMP4) {
        throw fail(400, "Nội dung file không phải video hợp lệ.");
      }

      await TryOnVideo.init();

      // Lấy chủ sở hữu từ phiên đăng nhập.
      key = {
        userId: req.user._id,
        recordingId,
      };

      const existing = await TryOnVideo.findOne(key).lean();

      if (existing) {
        if (String(existing.productId) !== productId) {
          throw fail(409, "Mã bản ghi đã thuộc sản phẩm khác.");
        }

        return res.json({
          data: toClient(existing),
        });
      }

      const productExists = await Product.exists({
        _id: productId,
        isDeleted: { $ne: true },
        status: "active",
      });

      if (!productExists) {
        throw fail(404, "Sản phẩm không còn khả dụng.");
      }

      uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "video",
            type: "authenticated",
            folder: `vestora/try-on/${req.user._id}`,
            public_id: randomUUID(),
            overwrite: false,
            timeout: 90_000,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        stream.on("error", reject);
        stream.end(buffer);
      });

      if (
        uploaded?.resource_type !== "video" ||
        !uploaded.width ||
        !uploaded.height ||
        !Number.isFinite(uploaded.duration) ||
        uploaded.duration <= 0 ||
        uploaded.duration > 31
      ) {
        throw fail(
          422,
          "Video không hợp lệ hoặc vượt thời lượng cho phép."
        );
      }

      saved = await TryOnVideo.create({
        ...key,
        productId,
        publicId: uploaded.public_id,
        format: uploaded.format,
        duration: uploaded.duration,
        bytes: uploaded.bytes,
      });

      return res.status(201).json({
        data: toClient(saved),
      });
    } catch (error) {
      // Kiểm tra lại để xử lý trường hợp ghi DB thành công
      // nhưng phản hồi bị lỗi, hoặc hai yêu cầu lưu trùng nhau.
      let existing = saved;
      let databaseChecked = false;

      if (!existing && key) {
        try {
          existing = await TryOnVideo.findOne(key).lean();
          databaseChecked = true;
        } catch {
          // Chưa xác định được trạng thái DB: chưa xóa asset.
        }
      }

      if (
        uploaded?.public_id &&
        !saved &&
        databaseChecked &&
        existing?.publicId !== uploaded.public_id
      ) {
        try {
          await cloudinary.uploader.destroy(uploaded.public_id, {
            resource_type: "video",
            type: "authenticated",
          });
        } catch {
          console.warn(
            "TRY_ON_VIDEO_CLEANUP_FAILED",
            uploaded.public_id
          );
        }
      }

      if (
        existing &&
        String(existing.productId) === req.body.productId
      ) {
        return res.json({
          data: toClient(existing),
        });
      }

      return res.status(error.expose ? error.status : 502).json({
        message: error.expose
          ? error.message
          : "Chưa lưu được video. Hãy bấm Lưu video để thử lại.",
      });
    }
  }
);

router.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    return res
      .status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
      .json({
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Video vượt quá giới hạn 20 MB."
            : "Dữ liệu upload video không hợp lệ.",
      });
  }

  return res.status(error.expose ? error.status : 500).json({
    message: error.expose
      ? error.message
      : "Không xử lý được yêu cầu video.",
  });
});

export default router;