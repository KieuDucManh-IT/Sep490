/**
 * Rental Return Routes
 * Nghiệm thu trả đồ & Quyết toán hoàn cọc
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-013..REQ-RENT-017
 */

import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';
import * as rentalReturnController from '../controllers/sale&rental/rentalReturnController.js';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import cloudinary from '../config/cloudinary.js';
import { RentalOrder } from '../models/sale&rental/RentalOrder.js';
import { OrderShipment } from '../models/sale&rental/OrderShipment.js';
import * as returnFlow from '../services/sale&rental/rentalReturnService.js';

const router = express.Router();

router.use(authMiddleware);
const handle = fn => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
    fields: 0,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'video/mp4',
      'video/webm',
    ].includes(file.mimetype);

    cb(
      allowed
        ? null
        : Object.assign(
          new Error('Chỉ hỗ trợ MP4/WebM.'),
          { status: 400 }
        ),
      true
    );
  },
}).single('video');

const receiveVideo = (req, res, next) =>
  videoUpload(req, res, error => {
    if (error) {
      return res.status(400).json({
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Video tối đa 50 MB.'
            : error.message,
      });
    }
    next();
  });

const videoLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: req => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
});

router.get(
  '/orders/:id/flow',
  handle(async (req, res) => {
    res.json({
      success: true,
      data: await returnFlow.getReturnFlow(
        req.user,
        req.params.id
      ),
    });
  })
);

router.post(
  '/orders/:id/physical-items',
  handle(async (req, res) => {
    res.json({
      success: true,
      data: await returnFlow.linkRentalInventory(
        req.user,
        req.params.id,
        req.body.assignments
      ),
    });
  })
);

router.post(
  '/orders/:id/request',
  handle(async (req, res) => {
    res.json({
      success: true,
      data: await returnFlow.requestSimulatedReturn(
        req.user,
        req.params.id
      ),
    });
  })
);

router.post(
  '/orders/:id/simulate',
  handle(async (req, res) => {
    res.json({
      success: true,
      data: await returnFlow.simulateReturnProgress(
        req.user,
        req.params.id,
        req.body.newStatus
      ),
    });
  })
);

router.post(
  '/orders/:id/complete',
  handle(async (req, res) => {
    if (req.body.confirmed !== true) {
      return res.status(400).json({
        message:
          'Cần xác nhận đã kiểm tra và ghi nhận tình trạng đồ trả.',
      });
    }

    res.json({
      success: true,
      data: await returnFlow.completeSimulatedReturn(
        req.user,
        req.params.id,
        {
          shipmentId: req.body.shipmentId,
          inspections: req.body.inspections,
          note: req.body.note,
        }
      ),
    });
  })
);

export function createEvidenceUploadHandlers({
  Model,
  checkAccess,
  statusFilter,
  folder,
}) {
  const checkUpload = async (req, res, next) => {
    try {
      await checkAccess(req.user, req.params.id, req.params.kind);
      next();
    } catch (error) {
      next(error);
    }
  };

  return [
    videoLimit,
    checkUpload,
    receiveVideo,
    handle(async (req, res) => {
      const { id, kind } = req.params;
      const field = await checkAccess(req.user, id, kind);
      const buffer = req.file?.buffer;

      const mp4 =
        req.file?.mimetype === 'video/mp4' &&
        buffer?.subarray(4, 8).toString('ascii') === 'ftyp';

      const webm =
        req.file?.mimetype === 'video/webm' &&
        buffer?.subarray(0, 4).toString('hex') === '1a45dfa3';

      if (!mp4 && !webm) {
        return res.status(400).json({
          message: 'Nội dung file không phải video MP4/WebM hợp lệ.',
        });
      }

      const publicId =
        folder + '/' + id + '/' + kind + '-' + randomUUID();

      let uploaded;

      try {
        uploaded = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              public_id: publicId,
              resource_type: 'video',
              type: 'authenticated',
              overwrite: false,
            },
            (error, result) => error ? reject(error) : resolve(result)
          ).end(buffer);
        });

        if (
          uploaded.resource_type !== 'video' ||
          !uploaded.format ||
          !uploaded.duration ||
          uploaded.duration > 300
        ) {
          throw Object.assign(
            new Error('Video phải phát được và dài tối đa 5 phút.'),
            { status: 400 }
          );
        }

        await checkAccess(req.user, id, kind);

        const videoPayload = {
          publicId,
          format: uploaded.format,
          uploadedBy: req.user._id,
          uploadedAt: new Date(),
        };

        const isRentalBatchEvidence =
          folder === 'rental-evidence' && ['return', 'return-received'].includes(kind);
        let savedToShipment = null;

        if (isRentalBatchEvidence) {
          const orderDoc = await Model.findById(id).select('rentalStatus').lean();
          const { shipment: activeShip } = await returnFlow.findCurrentReturnShipment(
            id,
            orderDoc?.rentalStatus
          );

          if (activeShip && ['preparing', 'shipped', 'delivered'].includes(activeShip.shipmentStatus)) {
            savedToShipment = await OrderShipment.findOneAndUpdate(
              { _id: activeShip._id, [field]: null },
              { $set: { [field]: videoPayload } },
              { new: true, runValidators: true }
            );
            if (!savedToShipment) {
              throw Object.assign(
                new Error('Đợt trả này đã có video, không ghi đè bằng chứng.'),
                { status: 409 }
              );
            }
          }
        }

        const orderQuery = savedToShipment
          ? { _id: id, ...statusFilter(kind) }
          : { _id: id, ...statusFilter(kind), [field]: null };

        const saved = await Model.findOneAndUpdate(
          orderQuery,
          {
            $set: { [field]: videoPayload },
            $inc: { returnFlowVersion: 1 },
          },
          { new: true, runValidators: true }
        );

        if (!saved) {
          if (savedToShipment) {
            await OrderShipment.updateOne(
              { _id: savedToShipment._id, [`${field}.publicId`]: publicId },
              { $set: { [field]: null } }
            ).catch(() => { });
          }
          throw Object.assign(
            new Error('Đơn vừa thay đổi hoặc đã có video.'),
            { status: 409 }
          );
        }

        res.json({ success: true });
      } catch (error) {
        if (uploaded) {
          try {
            const linkedOrder = await Model.exists({
              _id: id,
              [`${field}.publicId`]: publicId,
            });
            const linkedShip = folder === 'rental-evidence'
              ? await OrderShipment.exists({
                orderId: id,
                orderType: 'rental',
                shipmentType: 'return',
                [`${field}.publicId`]: publicId,
              })
              : false;

            if (!linkedOrder && !linkedShip) {
              await cloudinary.uploader.destroy(publicId, {
                resource_type: 'video',
                type: 'authenticated',
              });
            }
          } catch {
            // Giữ video nếu chưa xác định được kết quả ghi DB.
          }
        }

        throw error;
      }
    }),
  ];
}

router.post(
  '/orders/:id/evidence/:kind',
  ...createEvidenceUploadHandlers({
    Model: RentalOrder,
    checkAccess: returnFlow.checkEvidenceAccess,
    folder: 'rental-evidence',
    statusFilter: kind => ({
      rentalStatus: {
        $in: kind === 'packing'
          ? ['draft', 'confirmed']
          : ['renting', 'partially_returned', 'overdue'],
      },
    }),
  })
);

// 1. Nghiệm thu trả đồ & quyết toán cọc (Nhân viên showroom/kho)
router.post(
  '/orders/:id/return',
  requireRole('branchmanager', 'shopowner', 'owner', 'admin'),
  async (req, res, next) => {
    try {
      await returnFlow.accessReturnOrder(
        req.user,
        req.params.id,
        true
      );
      next();
    } catch (error) {
      next(error);
    }
  },
  rentalReturnController.createReturn
);

// 2. Chi tiết biên bản trả đồ
router.get('/:id', rentalReturnController.getReturnById);

export default router;
