/**
 * Rental Return & Deposit Settlement Service
 * Nghiệm thu KCS & Quyết toán hoàn cọc Ví (MongoDB ACID Transaction)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-013
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-014
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-015
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-016
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-017
 */

import crypto from 'node:crypto';
import { mongoose } from '../../config/db.js';
import { RentalReturn } from '../../models/sale&rental/RentalReturn.js';
import { RentalReturnDetail } from '../../models/sale&rental/RentalReturnDetail.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { RentalOrderItem } from '../../models/sale&rental/RentalOrderItem.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import {
  returnItems,
  closeReservations,
  releaseReserved,
  aggregateLines,
  withStatus,
} from '../warehouse/orderStockService.js';
import { refreshOutOfStockStatus } from '../warehouse/productStockStatusService.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { WalletTransaction } from '../../models/finance/WalletTransaction.js';
import {
  readyWallet,
  readBalances,
  changeFunds,
  inTransaction,
} from '../walletService.js';
import { Wallet } from '../../models/finance/Wallet.js';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { InventoryReservation } from '../../models/warehouse/inventory/InventoryReservation.js';
import { fetchOrderAndValidateScope } from '../shipping/shipmentHelpers.js';
import { createReturnShipment } from '../shipping/shipmentService.js';
import cloudinary from '../../config/cloudinary.js';

import {
  createRentalReturnSchema,
  settleDepositRefundSchema,
} from '../../validations/sale&rental/rentalReturnValidation.js';
import { ServiceError, generateWalletTxCode } from './rentalOrderService.js';
import { createNotification, notifyRoles } from '../system/notificationService.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../models/shop/Shop.js';

export const generateReturnCode = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `RET-${dateStr}-${rand}`;
};

/**
 * Tính toán phí trễ hạn (lateFee)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-014
 * lateFee = lateDays * (order.rentalFee / rentalDays) * 1.5
 */
export const calculateLateFee = (order, returnDate = new Date()) => {
  const dueTime = new Date(order.dueDate).getTime();
  const returnTime = new Date(returnDate).getTime();

  if (returnTime <= dueTime) {
    return { lateDays: 0, lateFee: 0 };
  }

  // Quá hạn: tính số ngày trễ theo mốc 24h
  const diffMs = returnTime - dueTime;
  const lateDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  const startTime = new Date(order.startDate).getTime();
  const rentalDays = Math.max(1, Math.round((dueTime - startTime) / (1000 * 60 * 60 * 24)));
  const dailyRate = order.rentalFee / rentalDays;

  // Phạt trễ hạn 150% đơn giá ngày
  const lateFee = Math.round(lateDays * dailyRate * 1.5);

  return { lateDays, lateFee };
};

/**
 * Lập biên bản trả hàng KCS & Quyết toán hoàn tiền cọc vào Ví trong 1 ACID Session
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-013
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-014
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-015
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-016
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-017
 */
export const createReturnReceiptAndSettle = async ({
  rentalOrderId,
  receivedBy,
  items,
  note = '',
  session: externalSession = null,
  deps = {},
}) => {
  const validation = createRentalReturnSchema.safeParse({
    rentalOrderId: String(rentalOrderId),
    receivedBy: receivedBy ? String(receivedBy) : undefined,
    items,
    note,
  });

  if (!validation.success) {
    const errorMsg = validation.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ServiceError(400, `Dữ liệu biên bản trả đồ không hợp lệ: ${errorMsg}`);
  }

  const order = await RentalOrder.findById(rentalOrderId);
  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn thuê');
  }

  if (!['renting', 'partially_returned'].includes(order.rentalStatus)) {
    throw new ServiceError(
      422,
      `Không thể lập biên bản trả đồ khi đơn đang ở trạng thái [${order.rentalStatus}]`
    );
  }

  const now = new Date();
  // Tìm vận đơn thu hồi để lấy mốc bưu tá nhận hàng từ khách (shippedAt), tính phạt trễ hạn công bằng
  const returnShipment = await OrderShipment.findOne({
    orderId: order._id,
    orderType: 'rental',
    shipmentType: 'return',
    shipmentStatus: { $in: ['shipped', 'delivered'] },
  }).sort({ createdAt: -1 });

  const effectiveReturnDate = returnShipment?.shippedAt || returnShipment?.deliveredAt || now;
  const { lateDays, lateFee } = calculateLateFee(order, effectiveReturnDate);

  // Tổng hợp phí hư hại từ KCS các hiện vật
  let totalDamageFee = 0;
  for (const item of items) {
    totalDamageFee += Number(item.damageFee || 0);
  }

  const totalDeductions = lateFee + totalDamageFee;
  // refundDeposit = max(0, depositAmount - totalDeductions)
  const refundDeposit = Math.max(0, order.depositAmount - totalDeductions);
  const excessDebt = Math.max(0, totalDeductions - order.depositAmount);

  const session = externalSession || (await mongoose.startSession());
  const isInternal = !externalSession;
  if (isInternal) session.startTransaction();

  try {
    const claimed = await RentalOrder.updateOne(
      {
        _id: order._id,
        rentalStatus: {
          $in: ['renting', 'partially_returned'],
        },
        depositStatus: 'held',
      },
      {
        $set: { rentalStatus: 'returned' },
      },
      { session }
    );

    if (claimed.matchedCount !== 1) {
      throw new ServiceError(
        409,
        'Đơn đã được quyết toán hoặc vừa thay đổi.'
      );
    }
    // 1. Tạo bản ghi RentalReturn
    const returnCode = generateReturnCode();
    const [rentalReturn] = await RentalReturn.create(
      [
        {
          returnCode,
          rentalOrderId: order._id,
          receivedBy: receivedBy || order.createdBy,
          returnStatus: 'completed',
          returnedAt: now,
          lateFee,
          damageFee: totalDamageFee,
          note: note
            ? `${note}; Trễ ${lateDays} ngày (phạt ${lateFee}đ)`
            : `Trễ ${lateDays} ngày (phạt ${lateFee}đ)`,
        },
      ],
      { session }
    );

    // 2. Tạo bản ghi RentalReturnDetail cho từng item
    const returnDetails = items.map((it) => ({
      rentalReturnId: rentalReturn._id,
      itemId: it.itemId,
      inspectionResult: it.inspectionResult,
      damageFee: Number(it.damageFee || 0),
      note: it.note || '',
    }));
    await RentalReturnDetail.insertMany(returnDetails, { session });

    // 3. TASK-016 A3: cập nhật hiện vật qua itemStateService theo kết quả kiểm:
    //    ok → available; needs_service → unavailable; missing → lost (không tính vào tồn, RentalOrderItem → missing).
    //    Không dùng `maintenance` ở chi nhánh (bảo trì chỉ ở kho tổng).
    const orderDetails = await RentalOrderDetail.find({ rentalOrderId: order._id }).select('_id').session(session);
    const handedOver = await RentalOrderItem.find({
      rentalOrderDetailId: { $in: orderDetails.map((d) => d._id) },
      itemId: { $in: items.map((it) => it.itemId) },
      status: 'handed_over',
    }).session(session);
    const handedOverIds = new Set(handedOver.map((row) => String(row.itemId)));
    const uniqueReturnIds = new Set(items.map((it) => String(it.itemId)));
    if (uniqueReturnIds.size !== items.length) {
      throw new ServiceError(422, 'Biên bản trả đồ có hiện vật bị trùng');
    }
    const invItems = await InventoryItem.find({ _id: { $in: [...uniqueReturnIds] } }).session(session);
    const invById = new Map(invItems.map((item) => [String(item._id), item]));
    const entries = items.map((it) => {
      const invItem = invById.get(String(it.itemId));
      if (!invItem || !handedOverIds.has(String(it.itemId))) {
        throw new ServiceError(422, `Hiện vật ${invItem?.itemCode || it.itemId} không thuộc đơn thuê này hoặc chưa được bàn giao`);
      }
      return { item: invItem, inspectionResult: it.inspectionResult };
    });
    await returnItems(entries, session);

    // Món mất không quay lại kho → không ghi +1.
    const backInStock = entries.filter(({ inspectionResult }) => inspectionResult !== 'missing');
    await StockMovement.insertMany(backInStock.map(({ item }) => ({
      variantId: item.variantId,
      itemId: item._id,
      locationId: item.locationId,
      storageId: null,
      movementType: 'rental_return',
      quantityChange: 1,
      referenceType: 'rental_return',
      referenceId: rentalReturn._id,
      createdBy: receivedBy || order.createdBy,
    })), { session });

    const missingIds = new Set(entries.filter(({ inspectionResult }) => inspectionResult === 'missing').map(({ item }) => String(item._id)));
    const rowsWith = (missing) => handedOver.filter((row) => missingIds.has(String(row.itemId)) === missing).map((row) => row._id);
    await RentalOrderItem.updateMany({ _id: { $in: rowsWith(false) } }, { $set: { status: 'returned' } }, { session });
    if (missingIds.size) {
      await RentalOrderItem.updateMany({ _id: { $in: rowsWith(true) } }, { $set: { status: 'missing' } }, { session });
    }

    // 4. Quyết toán Tiền cọc trong Ví nội bộ (ACID)
    if (order.depositStatus === 'held') {
      const getWallet = deps.readyWallet || readyWallet;
      const modifyFunds = deps.changeFunds || changeFunds;

      const wallet = await getWallet(order.customerId);

      // Số tiền khấu trừ cọc
      const deductedAmount = order.depositAmount - refundDeposit;

      const [settlementTx] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: order.customerId,
            code: generateWalletTxCode('SET-RNT'),
            transactionType: 'deposit_refund',
            direction: 'credit',
            amount: refundDeposit,
            currency: 'VND',
            status: 'success',
            referenceType: 'RentalOrder',
            referenceId: order._id,
          },
        ],
        { session }
      );

      // Mở khóa toàn bộ cọc: lockedDelta = -order.depositAmount
      // Nếu có khấu trừ do trễ hạn/hư hỏng: balanceDelta = -deductedAmount
      // Số dư khả dụng tăng đúng bằng: refundDeposit!
      const balanceDelta = deductedAmount > 0 ? -deductedAmount : 0;
      await modifyFunds(
        wallet,
        settlementTx,
        balanceDelta,
        -order.depositAmount,
        'rental_deposit_settlement',
        session
      );
    }

    // 5. Cập nhật trạng thái RentalOrder
    order.rentalStatus = 'returned';
    order.actualReturnedAt = now;
    if (refundDeposit === order.depositAmount) {
      order.depositStatus = 'refunded';
    } else if (refundDeposit > 0) {
      order.depositStatus = 'partially_deducted';
    } else {
      order.depositStatus = 'forfeited';
    }

    if (excessDebt > 0) {
      order.note = order.note
        ? `${order.note}; Dư nợ đền bù vượt cọc: ${excessDebt.toLocaleString('vi-VN')} đ`
        : `Dư nợ đền bù vượt cọc: ${excessDebt.toLocaleString('vi-VN')} đ`;
    }
    await order.save({ session });

    if (isInternal) await session.commitTransaction();

    // Thông báo cho khách hàng về kết quả nghiệm thu và hoàn cọc
    if (isInternal && order.customerId) {
      createNotification({
        userId: order.customerId,
        type: 'order_status',
        title: 'Hoàn tất nghiệm thu & quyết toán đơn thuê',
        message: `Đơn thuê #${order.orderCode} đã được nghiệm thu hoàn tất. Tiền cọc hoàn trả: ${refundDeposit.toLocaleString('vi-VN')} đ đã được chuyển vào ví của bạn. Cảm ơn bạn đã lựa chọn VESTORA!`,
        link: '/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, refundDeposit, excessDebt },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo nghiệm thu hoàn cọc:', err.message));
    }

    // Thông báo cho Quản lý chi nhánh & Chủ shop
    if (isInternal) {
      (async () => {
        try {
          const location = await InventoryLocation.findById(order.locationId).select('managerId shopId name').lean().catch(() => null);
          let shop = null;
          if (location?.shopId) {
            shop = await Shop.findById(location.shopId).select('managerId ownerId name').lean().catch(() => null);
          } else if (order.locationId) {
            shop = await Shop.findById(order.locationId).select('managerId ownerId name').lean().catch(() => null);
          }
          const branchName = shop?.name || location?.name || 'Chi nhánh';
          const branchManagerId = shop?.managerId || location?.managerId;
          const mgrMsg = `Đơn thuê #${order.orderCode} tại ${branchName} đã hoàn tất nghiệm thu và quyết toán cọc (Hoàn cọc: ${refundDeposit.toLocaleString('vi-VN')} đ).`;

          if (branchManagerId) {
            createNotification({
              userId: branchManagerId,
              type: 'order_status',
              title: `Đơn thuê #${order.orderCode} đã hoàn tất nghiệm thu`,
              message: mgrMsg,
              link: '/branch/rental-orders',
              referenceType: 'RentalOrder',
              referenceId: order._id,
              metadata: { orderCode: order.orderCode, refundDeposit, excessDebt, locationId: order.locationId },
            }).catch(() => {});
          } else {
            notifyRoles(['branch_manager'], {
              type: 'order_status',
              title: `Đơn thuê #${order.orderCode} đã hoàn tất nghiệm thu`,
              message: mgrMsg,
              link: '/branch/rental-orders',
              referenceType: 'RentalOrder',
              referenceId: order._id,
              metadata: { orderCode: order.orderCode, refundDeposit, excessDebt, locationId: order.locationId },
            }).catch(() => {});
          }

          if (shop?.ownerId && String(shop.ownerId) !== String(branchManagerId)) {
            createNotification({
              userId: shop.ownerId,
              type: 'order_status',
              title: `Đơn thuê #${order.orderCode} đã hoàn tất nghiệm thu`,
              message: mgrMsg,
              link: '/owner/rental-orders',
              referenceType: 'RentalOrder',
              referenceId: order._id,
              metadata: { orderCode: order.orderCode, refundDeposit, excessDebt, locationId: order.locationId },
            }).catch(() => {});
          } else if (!shop?.ownerId) {
            notifyRoles(['shopOwner', 'owner'], {
              type: 'order_status',
              title: `Đơn thuê #${order.orderCode} đã hoàn tất nghiệm thu`,
              message: mgrMsg,
              link: '/owner/rental-orders',
              referenceType: 'RentalOrder',
              referenceId: order._id,
              metadata: { orderCode: order.orderCode, refundDeposit, excessDebt, locationId: order.locationId },
            }).catch(() => {});
          }
        } catch (err) {
          console.error('[Notification] Lỗi gửi thông báo nghiệm thu cho quản lý:', err.message);
        }
      })();
    }

    // TASK-012: Trả hàng → tồn kho thay đổi → kiểm tra lại hết hàng
    // - Món đạt: available tăng → isOutOfStock có thể thành false
    // - Món cần xử lý / mất: không ảnh hưởng available, nhưng vẫn refresh để chắc chắn
    if (isInternal) {
      try {
        const variantIds = [...new Set(entries.map((e) => String(e.item.variantId)).filter(Boolean))];
        if (variantIds.length) {
          const { ProductVariant: PV } = await import('../../models/masterdata/ProductVariant.js');
          const variants = await PV.find({ _id: { $in: variantIds } }).select('productId').lean();
          const productIds = [...new Set(variants.map((v) => String(v.productId)).filter(Boolean))];
          if (productIds.length) {
            refreshOutOfStockStatus(productIds).catch((err) =>
              console.error('[TASK-012] rental return refresh lỗi:', err.message)
            );
          }
        }
      } catch (_) { /* non-blocking */ }
    }

    return {
      success: true,
      message: 'Nghiệm thu KCS và quyết toán hoàn cọc thành công',
      rentalReturn,
      settlementSummary: {
        totalDeposit: order.depositAmount,
        lateDays,
        lateFee,
        totalDamageFee,
        totalDeductions,
        refundDeposit,
        excessDebt,
        depositStatus: order.depositStatus,
      },
    };
  } catch (err) {
    if (isInternal) await session.abortTransaction();
    throw withStatus(err);
  } finally {
    if (isInternal) session.endSession();
  }
};
export const returnSimulatorEnabled = () =>
  process.env.NODE_ENV !== 'production' &&
  process.env.ENABLE_GHN_SIMULATOR === 'true';

const returnable = order =>
  ['renting', 'overdue'].includes(order.rentalStatus);

const staffRole = user =>
  ['admin', 'owner', 'shopowner', 'branchmanager'].includes(
    String(user?.Role || user?.role || '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
  );

export const EVIDENCE_FIELDS = Object.freeze({
  packing: 'packingVideo',
  receiving: 'receivingVideo',
  return: 'returnVideo',
  'return-received': 'returnReceivedVideo',
});

async function evidencePermissions(order, user, manager, shipment) {
  const owner =
    String(order.customerId?._id || order.customerId) ===
    String(user._id);

  const outboundStarted = await OrderShipment.exists({
    orderId: order._id,
    orderType: 'rental',
    shipmentType: 'outbound',
    shipmentStatus: { $in: ['shipped', 'delivered'] },
  });

  return {
    packing:
      manager &&
      ['draft', 'confirmed'].includes(order.rentalStatus) &&
      !outboundStarted,

    receiving: owner && returnable(order),

    return:
      owner &&
      returnable(order) &&
      (!shipment || shipment.shipmentStatus === 'preparing'),

    'return-received':
      manager &&
      returnable(order) &&
      shipment?.shipmentStatus === 'delivered',
  };
}

// Khách chỉ thao tác đơn của mình; quản lý phải đúng phạm vi chi nhánh.
export async function accessReturnOrder(
  user,
  id,
  staffOnly = false,
  session = null
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ServiceError(400, 'Mã đơn không hợp lệ.');
  }

  const order = await RentalOrder.findById(id)
    .select(
      '+packingVideo +receivingVideo +returnVideo +returnReceivedVideo'
    )
    .session(session);

  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn thuê.');
  }

  const manager = staffRole(user);

  if (manager) {
    try {
      await fetchOrderAndValidateScope(user, 'rental', id);
    } catch (error) {
      throw withStatus(error);
    }
  } else if (
    staffOnly ||
    String(order.customerId) !== String(user?._id)
  ) {
    throw new ServiceError(
      403,
      'Bạn không có quyền thao tác đơn thuê này.'
    );
  }

  return { order, manager };
}

function signedEvidence(video) {
  if (!video) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + 900;

  return {
    uploadedAt: video.uploadedAt,
    expiresAt: expiresAt * 1000,
    url: cloudinary.utils.private_download_url(
      video.publicId,
      video.format,
      {
        resource_type: 'video',
        type: 'authenticated',
        attachment: false,
        expires_at: expiresAt,
      }
    ),
  };
}

// Dữ liệu cho cửa sổ trả đồ: không có giá trong danh sách sản phẩm.
export async function getReturnFlow(user, id) {
  const { order, manager } = await accessReturnOrder(user, id);

  await order.populate([
    {
      path: 'customerId',
      select: 'FullName Email Information',
    },
    {
      path: 'locationId',
      populate: { path: 'shopId' },
    },
  ]);

  const details = await RentalOrderDetail.find({
    rentalOrderId: id,
  })
    .populate({
      path: 'variantId',
      select: 'sku size color productId',
      populate: {
        path: 'productId',
        select: 'name images image',
      },
    })
    .lean();

  const shipment = await OrderShipment.findOne({
    orderId: id,
    orderType: 'rental',
    shipmentType: 'return',
  })
    .sort({ createdAt: -1 })
    .lean();

  const videoPermissions = await evidencePermissions(
    order,
    user,
    manager,
    shipment
  );

  const shop =
    order.locationId?.shopId || order.locationId || {};

  return {
    orderCode: order.orderCode,
    rentalStatus: order.rentalStatus,
    startDate: order.startDate,
    dueDate: order.dueDate,

    customer: {
      name:
        order.shippingAddress?.receiverName ||
        order.customerId?.FullName ||
        '',
      phone: order.shippingAddress?.phone || '',
      address: [
        order.shippingAddress?.street,
        order.shippingAddress?.ward,
        order.shippingAddress?.district,
        order.shippingAddress?.city,
      ]
        .filter(Boolean)
        .join(', '),
    },

    shop: {
      name: shop.name || '',
      address: shop.address || '',
      phone: shop.phone || '',
    },

    items: details.map(d => ({
      id: d._id,
      name: d.variantId?.productId?.name || 'Trang phục',
      sku: d.variantId?.sku || '',
      size: d.variantId?.size || '',
      color: d.variantId?.color || '',
      quantity: d.quantity,
      image:
        d.variantId?.productId?.images?.[0] ||
        d.variantId?.productId?.image ||
        '',
    })),

    ...Object.fromEntries(
      Object.values(EVIDENCE_FIELDS).map(field => [
        field,
        signedEvidence(order[field]),
      ])
    ),
    videoPermissions,
    shipment,
    canManage: String(user?.Role || user?.role || '').toLowerCase().replace(/[\s_-]/g, '').replace('brandmanager', 'branchmanager') === 'branchmanager',
    simulatorEnabled: returnSimulatorEnabled() && String(user?.Role || user?.role || '').toLowerCase().replace(/[\s_-]/g, '').replace('brandmanager', 'branchmanager') === 'branchmanager',
    canRequest: returnable(order) && (!shipment || ['cancelled', 'failed'].includes(shipment.shipmentStatus)),
    completed: order.rentalStatus === 'returned',
    refundedAmount:
      order.depositStatus === 'refunded'
        ? order.depositAmount
        : null,
  };
}

export async function checkEvidenceAccess(user, id, kind) {
  const { order, manager } = await accessReturnOrder(user, id);

  if (!Object.hasOwn(EVIDENCE_FIELDS, kind)) {
    throw new ServiceError(400, 'Loại video không hợp lệ.');
  }

  const shipment = await OrderShipment.findOne({
    orderId: id,
    orderType: 'rental',
    shipmentType: 'return',
  })
    .sort({ createdAt: -1 })
    .lean();

  const permissions = await evidencePermissions(
    order,
    user,
    manager,
    shipment
  );

  if (!permissions[kind]) {
    throw new ServiceError(
      403,
      'Bạn không thể tải loại video này ở trạng thái hiện tại của đơn.'
    );
  }

  const field = EVIDENCE_FIELDS[kind];

  if (order[field]) {
    throw new ServiceError(
      409,
      'Video đã được lưu, không ghi đè bằng chứng.'
    );
  }

  return field;
}

export async function requestSimulatedReturn(user, id) {
  if (!returnSimulatorEnabled()) {
    throw new ServiceError(
      403,
      'Chưa bật mô phỏng trả đồ trên môi trường dev.'
    );
  }

  await accessReturnOrder(user, id);

  // Tạo vận đơn thu hồi GHN thật
  return await createReturnShipment(user, { orderId: id });
}

export async function simulateReturnProgress(
  user,
  id,
  newStatus
) {
  if (!returnSimulatorEnabled()) {
    throw new ServiceError(
      403,
      'Mô phỏng chỉ được phép trên dev.'
    );
  }

  const userRole = String(user?.Role || user?.role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace('brandmanager', 'branchmanager');

  if (userRole !== 'branchmanager') {
    throw new ServiceError(
      403,
      'Chỉ có Quản lý chi nhánh (Branch Manager) mới có quyền mô phỏng trạng thái vận đơn.'
    );
  }

  await accessReturnOrder(user, id, true);

  const transitions = {
    preparing: 'shipped',
    shipped: 'delivered',
  };

  const shipment = await OrderShipment.findOne({
    orderId: id,
    orderType: 'rental',
    shipmentType: 'return',
  }).sort({ createdAt: -1 });

  if (!shipment) {
    throw new ServiceError(
      404,
      'Chưa có vận đơn trả đồ.'
    );
  }

  if (shipment.shipmentStatus === newStatus) return shipment;

  if (transitions[shipment.shipmentStatus] !== newStatus) {
    throw new ServiceError(
      409,
      'Không được bỏ bước hoặc lùi trạng thái.'
    );
  }

  const now = new Date();

  const updated = await OrderShipment.findOneAndUpdate(
    {
      _id: shipment._id,
      shipmentStatus: shipment.shipmentStatus,
    },
    {
      $set: {
        shipmentStatus: newStatus,
        [newStatus === 'shipped' ? 'shippedAt' : 'deliveredAt']:
          now,
      },
      $push: {
        statusHistory: {
          status: newStatus,
          timestamp: now,
          description:
            newStatus === 'shipped'
              ? 'Đã lấy đồ từ khách, đang chuyển về shop (mô phỏng)'
              : 'Đã giao đồ về shop, chờ nghiệm thu (mô phỏng)',
        },
      },
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new ServiceError(
      409,
      'Trạng thái vừa thay đổi, hãy tải lại.'
    );
  }

  if (newStatus === 'delivered') {
    await RentalOrder.updateOne(
      { _id: id },
      { $set: { lastReturnDeliveredAt: now } }
    );
  }

  return updated;
}

export async function releaseSimulatedReservations(
  order,
  details,
  session
) {
  const reservations = await InventoryReservation.find({
    orderId: order._id,
    orderType: 'rental',
  }).session(session);

  const movements = await StockMovement.exists({
    referenceType: 'rental_order',
    referenceId: order._id,
    movementType: 'rental_out',
  }).session(session);

  // Đã xuất kho thật thì phải xử lý theo nghiệp vụ bàn giao.
  if (
    movements ||
    reservations.some(row => row.status !== 'active')
  ) {
    throw new ServiceError(
      409,
      'Đơn đã có nghiệp vụ xuất kho; cần nghiệm thu theo hiện vật đã bàn giao.'
    );
  }

  if (!reservations.length) return;

  const expected = new Map(
    aggregateLines(details).map(line => [
      String(line.variantId),
      line.quantity,
    ])
  );

  const actual = new Map(
    aggregateLines(reservations).map(line => [
      String(line.variantId),
      line.quantity,
    ])
  );

  const wrongLocation = reservations.some(
    row => String(row.locationId) !== String(order.locationId)
  );

  const wrongQuantity =
    expected.size !== actual.size ||
    [...expected].some(([id, qty]) => actual.get(id) !== qty);

  if (wrongLocation || wrongQuantity) {
    throw new ServiceError(
      409,
      'Giữ chỗ tồn kho không khớp chi nhánh hoặc số lượng của đơn.'
    );
  }

  const reservedByVariant = await closeReservations(
    {
      orderId: order._id,
      orderType: 'rental',
    },
    'released',
    session
  );

  await releaseReserved(
    {
      locationId: order.locationId,
      reservedByVariant,
    },
    session
  );
}
export async function validateDepositHold(
  order,
  wallet,
  amount,
  session
) {
  if (!wallet || order.paymentMethod !== 'wallet') {
    throw new ServiceError(
      409,
      'Không tìm thấy ví giữ cọc của chủ đơn.'
    );
  }

  const hold = await WalletTransaction.findOne({
    userId: order.customerId,
    referenceId: order._id,
    referenceType: 'RentalOrder',
    transactionType: 'rental_deposit',
    status: 'success',
  }).session(session);

  if (hold) {
    const wrongWallet =
      String(hold.walletId) !== String(wallet._id);

    const wrongReference =
      order.depositHoldTransactionId &&
      String(order.depositHoldTransactionId) !== String(hold._id);

    if (wrongWallet || hold.amount !== amount || wrongReference) {
      throw new ServiceError(
        409,
        'Giao dịch giữ cọc không khớp đúng đơn và đúng ví.'
      );
    }

    return;
  }

  // Đơn mới đã ghi thông tin thanh toán phải có chứng từ liên kết.
  if (order.depositHoldTransactionId || order.paidAmount > 0) {
    throw new ServiceError(
      409,
      'Thiếu giao dịch giữ cọc đã liên kết với đơn.'
    );
  }

  // Tương thích hàm tạo đơn cũ: đã khóa cọc cùng transaction
  // nhưng chưa ghi rental_deposit riêng và paidAmount còn bằng 0.
  const others = await RentalOrder.find({
    customerId: order.customerId,
    _id: { $ne: order._id },
    paymentMethod: 'wallet',
    depositStatus: {
      $in: ['held', 'partially_refunded', 'partially_deducted'],
    },
  })
    .select('depositAmount depositStatus')
    .session(session);

  if (
    others.some(
      row =>
        row.depositStatus !== 'held' ||
        !Number.isSafeInteger(row.depositAmount)
    )
  ) {
    throw new ServiceError(
      409,
      'Ví có khoản cọc đang quyết toán một phần; cần đối soát số tiền còn giữ.'
    );
  }

  const totalHeld = others.reduce(
    (total, row) => total + row.depositAmount,
    amount
  );

  if (
    !Number.isSafeInteger(totalHeld) ||
    readBalances(wallet).lockedBalance < totalHeld
  ) {
    throw new ServiceError(
      409,
      'Tiền khóa không đủ khớp các khoản cọc đang giữ của khách hàng.'
    );
  }
}
// Luồng nhận đủ đồ nguyên vẹn và hoàn toàn bộ tiền cọc.
export async function completeSimulatedReturn(user, id) {
  if (!returnSimulatorEnabled()) {
    throw new ServiceError(
      403,
      'Luồng mô phỏng chưa được bật.'
    );
  }

  const userRole = String(user?.Role || user?.role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace('brandmanager', 'branchmanager');

  if (userRole !== 'branchmanager') {
    throw new ServiceError(
      403,
      'Chỉ có Quản lý chi nhánh (Branch Manager) mới có quyền hoàn tất đơn qua luồng mô phỏng.'
    );
  }

  await accessReturnOrder(user, id, true);

  return inTransaction(async session => {
    const { order } = await accessReturnOrder(
      user,
      id,
      true,
      session
    );

    const businessKey = `rental-return:${id}`;

    // Gửi lại request không được hoàn tiền lần hai.
    if (order.rentalStatus === 'returned') {
      const previous = await WalletTransaction.findOne({
        businessKey,
      }).session(session);

      return {
        refundedAmount: previous?.amount || 0,
        alreadyCompleted: true,
      };
    }

    const shipment = await OrderShipment.findOne({
      orderId: id,
      orderType: 'rental',
      shipmentType: 'return',
      shipmentStatus: 'delivered',
    }).session(session);

    if (!shipment || !returnable(order)) {
      throw new ServiceError(
        409,
        'Đồ chưa được giao về shop.'
      );
    }

    if (!order.returnReceivedVideo) {
      throw new ServiceError(
        422,
        'Shop phải tải video nhận đồ trả trước khi hoàn tất và hoàn cọc.'
      );
    }

    const amount = order.depositAmount;

    if (
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      order.paymentStatus !== 'paid' ||
      (amount > 0 && order.depositStatus !== 'held')
    ) {
      throw new ServiceError(
        409,
        'Trạng thái thanh toán hoặc tiền cọc không hợp lệ.'
      );
    }

    const claimed = await RentalOrder.updateOne(
      {
        _id: id,
        rentalStatus: order.rentalStatus,
        depositStatus: order.depositStatus,
      },
      {
        $set: {
          rentalStatus: 'returned',
          depositStatus: 'refunded',
          actualReturnedAt: new Date(),
        },
      },
      { session }
    );

    if (claimed.matchedCount !== 1) {
      throw new ServiceError(
        409,
        'Đơn vừa được quyết toán.'
      );
    }

    const details = await RentalOrderDetail.find({
      rentalOrderId: id,
    }).session(session);

    if (!details.length) {
      throw new ServiceError(
        409,
        'Đơn chưa có chi tiết sản phẩm.'
      );
    }

    const rows = await RentalOrderItem.find({
      rentalOrderDetailId: {
        $in: details.map(d => d._id),
      },
    }).session(session);

    const handedOver = rows.filter(
      r => r.status === 'handed_over'
    );

    // Có theo dõi hiện vật thì phải nhận đủ hiện vật đã bàn giao.
    if (
      rows.length &&
      (
        handedOver.length !== rows.length ||
        rows.length !==
        details.reduce((sum, d) => sum + d.quantity, 0)
      )
    ) {
      throw new ServiceError(
        409,
        'Chưa bàn giao đủ hiện vật hoặc đã có trả một phần; cần nghiệm thu chi tiết.'
      );
    }

    if (!rows.length) {
      await releaseSimulatedReservations(order, details, session);
    } else if (
      await InventoryReservation.exists({
        orderId: id,
        orderType: 'rental',
        status: 'active',
      }).session(session)
    ) {
      throw new ServiceError(
        409,
        'Đơn có hiện vật đã bàn giao nhưng vẫn giữ chỗ; cần đối soát tồn kho.'
      );
    }

    const [receipt] = await RentalReturn.create(
      [
        {
          returnCode: generateReturnCode(),
          rentalOrderId: id,
          receivedBy: user._id,
          returnStatus: 'completed',
          returnedAt: new Date(),
          note:
            'Shop xác nhận nhận đủ đồ nguyên vẹn; hoàn đủ tiền cọc. Vận chuyển mô phỏng.',
        },
      ],
      { session }
    );

    if (handedOver.length) {
      const inventory = await InventoryItem.find({
        _id: { $in: handedOver.map(r => r.itemId) },
      }).session(session);

      if (inventory.length !== handedOver.length) {
        throw new ServiceError(
          409,
          'Thiếu hiện vật trong kho.'
        );
      }

      await returnItems(
        inventory.map(item => ({
          item,
          conditionOnReturn: 'good',
        })),
        session
      );

      await RentalReturnDetail.insertMany(
        inventory.map(item => ({
          rentalReturnId: receipt._id,
          itemId: item._id,
          conditionOnReturn: 'good',
          itemReturnStatus: 'accepted',
        })),
        { session }
      );

      await StockMovement.insertMany(
        inventory.map(item => ({
          itemId: item._id,
          variantId: item.variantId,
          locationId: item.locationId,
          storageId: null,
          movementType: 'rental_return',
          quantityChange: 1,
          referenceType: 'rental_return',
          referenceId: receipt._id,
          createdBy: user._id,
        })),
        { session }
      );

      await RentalOrderItem.updateMany(
        { _id: { $in: handedOver.map(r => r._id) } },
        { $set: { status: 'returned' } },
        { session }
      );
    }

    if (amount > 0) {
      const wallet = await Wallet.findOne({
        userId: order.customerId,
      })
        .select('+balanceEncrypted +lockedBalanceEncrypted')
        .session(session);

      await validateDepositHold(order, wallet, amount, session);

      const [tx] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: order.customerId,
            businessKey,
            code: generateWalletTxCode('REF-RNT'),
            transactionType: 'deposit_refund',
            direction: 'credit',
            amount,
            status: 'success',
            referenceType: 'RentalOrder',
            referenceId: order._id,
            completedAt: new Date(),
          },
        ],
        { session }
      );

      // Tiền cọc đã nằm trong tổng balance.
      // Chỉ giảm tiền bị khóa để tăng số dư khả dụng.
      await changeFunds(
        wallet,
        tx,
        0,
        -amount,
        'rental_deposit_settlement',
        session
      );

      await tx.save({ session });
    }

    return {
      refundedAmount: amount,
      alreadyCompleted: false,
    };
  });
}
