import multer from 'multer';
import rateLimit from 'express-rate-limit';

import {
  MAX_VIDEO_BYTES,
  VIDEO_MIME_TYPES,
} from '../services/sale&rental/rentalEvidenceService.js';

export const evidenceUploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,

  keyGenerator: (req) => String(req.user._id),

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Bạn đã tải quá nhiều video. Vui lòng thử lại sau 10 phút.',
  },
});

const parser = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_VIDEO_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  },

  fileFilter: (req, file, done) => {
    if (!VIDEO_MIME_TYPES.includes(file.mimetype)) {
      const error = Object.assign(
        new Error('Chỉ hỗ trợ video MP4, MOV hoặc WebM.'),
        { status: 400 }
      );

      done(error);
      return;
    }

    done(null, true);
  },
}).single('video');

const activeUsers = new Set();

export function parseEvidenceVideo(req, res, next) {
  const userId = String(req.user._id);

  if (
    activeUsers.has(userId) ||
    activeUsers.size >= 4
  ) {
    return res.status(429).json({
      success: false,
      message:
        'Đang có video được tải lên. Vui lòng thử lại sau.',
    });
  }

  activeUsers.add(userId);

  let released = false;

  const release = () => {
    if (released) return;

    released = true;
    activeUsers.delete(userId);
  };

  req.releaseEvidenceUpload = release;

  res.once('finish', release);
  req.once('aborted', release);

  parser(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    release();

    if (error instanceof multer.MulterError) {
      const isTooLarge =
        error.code === 'LIMIT_FILE_SIZE';

      return res.status(isTooLarge ? 413 : 400).json({
        success: false,
        message: isTooLarge
          ? 'Video không được vượt quá 50 MB.'
          : 'Mỗi lần chỉ tải lên một video trong trường video.',
      });
    }

    next(error);
  });
}