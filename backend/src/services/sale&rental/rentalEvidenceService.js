import { randomUUID } from 'node:crypto';

import cloudinary from '../../config/cloudinary.js';

import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderEvidence } from '../../models/sale&rental/RentalOrderEvidence.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../models/shop/Shop.js';

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const fail = (status, message) =>
  Object.assign(new Error(message), { status });

const idOf = (value) =>
  String(value?._id || value || '');

const roleOf = (user) =>
  String(user?.Role || user?.role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace('brandmanager', 'branchmanager');

export function validateEvidenceVideo(file) {
  if (!file?.buffer?.length) {
    throw fail(400, 'Vui lòng chọn một video để tải lên.');
  }

  if (file.buffer.length > MAX_VIDEO_BYTES) {
    throw fail(413, 'Video không được vượt quá 50 MB.');
  }

  const name = String(file.originalname || '').toLowerCase();

  if (
    !VIDEO_MIME_TYPES.includes(file.mimetype) ||
    !/\.(mp4|mov|webm)$/.test(name)
  ) {
    throw fail(400, 'Chỉ hỗ trợ video MP4, MOV hoặc WebM.');
  }

  const buffer = file.buffer;

  const mp4 =
    buffer.length >= 12 &&
    buffer.toString('ascii', 4, 8) === 'ftyp';

  const webm =
    buffer.length >= 4 &&
    buffer
      .subarray(0, 4)
      .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));

  const valid =
    file.mimetype === 'video/webm' ? webm : mp4;

  if (!valid) {
    throw fail(
      400,
      'Nội dung file không phải video MP4, MOV hoặc WebM hợp lệ.'
    );
  }
}

export function createRentalEvidenceService({
  orders = RentalOrder,
  evidence = RentalOrderEvidence,
  locations = InventoryLocation,
  shops = Shop,
  cloud = cloudinary,

  // Cấu hình mặc định dành cho đơn thuê.
  orderIdField = 'rentalOrderId',
  statusField = 'rentalStatus',
  orderLabel = 'đơn thuê',
  cloudFolder = 'rental-evidence',
} = {}) {
  async function authorize(orderId, user, kind) {
    if (!user?._id) {
      throw fail(401, 'Bạn cần đăng nhập.');
    }

    if (!/^[a-f\d]{24}$/i.test(String(orderId))) {
      throw fail(400, `Mã ${orderLabel} không hợp lệ.`);
    }

    if (kind && !['packing', 'receiving'].includes(kind)) {
      throw fail(400, 'Loại video không hợp lệ.');
    }

    const order = await orders.findById(orderId).lean();

    if (!order) {
      throw fail(404, `Không tìm thấy ${orderLabel}.`);
    }

    const role = roleOf(user);

    let uploadKind;

    if (
      role === 'customer' &&
      idOf(order.customerId) === idOf(user)
    ) {
      uploadKind = 'receiving';
    } else if (role === 'admin') {
      uploadKind = 'packing';
    } else if (
      ['branchmanager', 'owner', 'shopowner'].includes(role)
    ) {
      const location = await locations
        .findById(order.locationId)
        .lean();

      const shop = location?.shopId
        ? await shops.findById(location.shopId).lean()
        : null;

      const managed =
        role === 'branchmanager' &&
        (
          shop
            ? !shop.isDeleted &&
              idOf(shop.managerId) === idOf(user)
            : location?.type === 'store' &&
              !location.shopId &&
              idOf(location.managerId) === idOf(user)
        );

      const owned =
        ['owner', 'shopowner'].includes(role) &&
        shop &&
        !shop.isDeleted &&
        idOf(shop.ownerId) === idOf(user);

      if (managed || owned) {
        uploadKind = 'packing';
      }
    }

    if (!uploadKind) {
      throw fail(
        403,
        `Bạn không có quyền xem bằng chứng của ${orderLabel} này.`
      );
    }

    if (kind && kind !== uploadKind) {
      throw fail(
        403,
        'Bạn không có quyền tải loại video này.'
      );
    }

    if (kind && order[statusField] === 'cancelled') {
      throw fail(
        409,
        'Đơn đã hủy chỉ cho phép xem video đã tải.'
      );
    }

    return {
      order,
      uploadKind:
        order[statusField] === 'cancelled'
          ? null
          : uploadKind,
    };
  }

  function present(record) {
    const expiresAt =
      Math.floor(Date.now() / 1000) + 3600;

    return {
      _id: record._id,
      kind: record.kind,
      originalName: record.originalName,
      uploaderName: record.uploaderName,
      createdAt: record.createdAt,
      bytes: record.bytes,
      duration: record.duration,

      urlExpiresAt: new Date(
        expiresAt * 1000
      ).toISOString(),

      url: cloud.utils.private_download_url(
        record.publicId,
        record.format,
        {
          resource_type: 'video',
          type: 'authenticated',
          attachment: false,
          expires_at: expiresAt,
        }
      ),
    };
  }

  async function list(orderId, user) {
    const { uploadKind } = await authorize(
      orderId,
      user
    );

    const records = await evidence
      .find({
        [orderIdField]: orderId,
      })
      .sort({ createdAt: -1 })
      .lean();

    return {
      videos: records.map(present),
      uploadKind,
      maxBytes: MAX_VIDEO_BYTES,
    };
  }

  async function removeCloudVideo(publicId) {
    try {
      await cloud.uploader.destroy(publicId, {
        resource_type: 'video',
        type: 'authenticated',
        invalidate: true,
      });
    } catch {
      console.error(
        '[Order evidence] Cần dọn video Cloudinary:',
        publicId
      );
    }
  }

  async function upload(orderId, user, file, kind) {
    await authorize(orderId, user, kind);

    validateEvidenceVideo(file);

    const config = cloud.config();

    if (
      !config.cloud_name ||
      !config.api_key ||
      !config.api_secret
    ) {
      throw fail(
        503,
        'Chưa cấu hình Cloudinary trên máy chủ. Vui lòng liên hệ quản trị viên.'
      );
    }

    const publicId =
      `vestora/${cloudFolder}/${orderId}/${kind}/${randomUUID()}`;

    let uploaded;

    try {
      uploaded = await new Promise((resolve, reject) => {
        const stream = cloud.uploader.upload_stream(
          {
            resource_type: 'video',
            type: 'authenticated',
            public_id: publicId,
            overwrite: false,
            allowed_formats: ['mp4', 'mov', 'webm'],
            timeout: 120000,
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          }
        );

        stream.on('error', reject);

        // Gửi buffer lên Cloudinary, không ghi video xuống ổ đĩa.
        stream.end(file.buffer);
      });
    } catch {
      await removeCloudVideo(publicId);

      throw fail(
        502,
        'Không thể tải video lên Cloudinary. Vui lòng thử lại.'
      );
    }

    let saved;

    try {
      if (
        uploaded?.resource_type !== 'video' ||
        !(uploaded.width > 0 && uploaded.height > 0) ||
        !uploaded.secure_url?.startsWith('https://') ||
        !uploaded.format
      ) {
        throw fail(
          400,
          'Cloudinary không nhận diện được hình ảnh trong video. Vui lòng chọn video khác.'
        );
      }

      // Kiểm tra lại quyền và trạng thái sau khi upload.
      await authorize(orderId, user, kind);

      saved = await evidence.create({
        [orderIdField]: orderId,

        kind,
        uploadedBy: user._id,

        uploaderName:
          user.FullName ||
          user.name ||
          (
            kind === 'packing'
              ? 'Chi nhánh'
              : 'Khách hàng'
          ),

        originalName: String(file.originalname)
          .split(/[\\/]/)
          .pop()
          .slice(0, 180),

        publicId,
        url: uploaded.secure_url,
        format: uploaded.format,
        bytes: uploaded.bytes || file.buffer.length,
        duration: uploaded.duration || 0,
      });
    } catch (error) {
      await removeCloudVideo(publicId);

      if (error.status) {
        throw error;
      }

      throw fail(
        503,
        'Chưa lưu được thông tin video. Vui lòng thử lại.'
      );
    }

    return present(saved);
  }

  return {
    authorize,
    list,
    upload,
  };
}

export const rentalEvidenceService =
  createRentalEvidenceService();