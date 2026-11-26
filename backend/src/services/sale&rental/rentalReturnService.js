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
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
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
} from '../../validations/sale&rental/rentalReturnValidation.js';
import { ServiceError, generateWalletTxCode } from './rentalOrderService.js';

export const generateReturnCode = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `RET-${dateStr}-${rand}`;
};

/**
 * Tính toán phí trễ hạn (lateFee)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-014
 * lateFee = lateDays * (basisRentalFee / rentalDays) * 1.5
 */
export const calculateLateFee = (order, returnDate = new Date(), basisRentalFee = null) => {
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
  const effectiveFee = basisRentalFee != null ? Number(basisRentalFee) : Number(order.rentalFee || 0);
  const dailyRate = effectiveFee / rentalDays;

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

  if (!['renting', 'overdue', 'partially_returned'].includes(order.rentalStatus)) {
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

  const lockedAvailable = remainingLockedDepositOf(order);
  const totalDeductions = lateFee + totalDamageFee;
  const refundDeposit = Math.max(0, lockedAvailable - totalDeductions);
  const deductFromLocked = Math.min(lockedAvailable, totalDeductions);
  const excessDebt = Math.max(0, totalDeductions - lockedAvailable);

  const session = externalSession || (await mongoose.startSession());
  const isInternal = !externalSession;
  if (isInternal) session.startTransaction();

  try {
    const claimed = await RentalOrder.updateOne(
      {
        _id: order._id,
        rentalStatus: {
          $in: ['renting', 'overdue', 'partially_returned'],
        },
        ...(lockedAvailable > 0
          ? { depositStatus: { $in: ['held', 'partially_refunded', 'partially_deducted'] } }
          : {}),
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
          shipmentId: returnShipment?._id || null,
          receivedBy: receivedBy || order.createdBy,
          returnStatus: 'completed',
          returnedAt: now,
          lateFee,
          damageFee: totalDamageFee,
          depositRefunded: refundDeposit,
          note: note
            ? `${note}; Trễ ${lateDays} ngày (phạt ${lateFee}đ)`
            : `Trễ ${lateDays} ngày (phạt ${lateFee}đ)`,
        },
      ],
      { session }
    );

    const handedOverByItemId = new Map(handedOver.map((row) => [String(row.itemId), row]));
    const returnDetails = items.map((it) => ({
      rentalReturnId: rentalReturn._id,
      rentalOrderDetailId: handedOverByItemId.get(String(it.itemId))?.rentalOrderDetailId || null,
      quantityReturned: 1,
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

    const remainingHandedOverCount = await RentalOrderItem.countDocuments({
      rentalOrderDetailId: { $in: orderDetails.map((d) => d._id) },
      status: 'handed_over',
    }).session(session);
    const isFinalReceipt = remainingHandedOverCount === 0;

    // 4. Quyết toán Tiền cọc trong Ví nội bộ (ACID)
    if (lockedAvailable > 0 && ['held', 'partially_refunded', 'partially_deducted'].includes(order.depositStatus)) {
      const getWallet = deps.readyWallet || readyWallet;
      const modifyFunds = deps.changeFunds || changeFunds;

      const wallet = await getWallet(order.customerId);
      const isZeroRefund = refundDeposit === 0 && deductFromLocked > 0;

      const [settlementTx] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: order.customerId,
            code: generateWalletTxCode(isZeroRefund ? 'ADJ-RNT' : 'SET-RNT'),
            transactionType: isZeroRefund ? 'adjustment' : 'deposit_refund',
            direction: isZeroRefund ? 'debit' : 'credit',
            amount: isZeroRefund ? deductFromLocked : refundDeposit,
            currency: 'VND',
            status: 'success',
            referenceType: 'RentalOrder',
            referenceId: order._id,
          },
        ],
        { session }
      );

      const balanceDelta = deductFromLocked > 0 ? -deductFromLocked : 0;
      await modifyFunds(
        wallet,
        settlementTx,
        balanceDelta,
        -lockedAvailable,
        'rental_deposit_settlement',
        session
      );
    }

    // 5. Cập nhật trạng thái RentalOrder
    const totalRefunded = Number(order.refundedDepositAmount || 0) + refundDeposit;
    const totalDeducted = Number(order.deductedDepositAmount || 0) + deductFromLocked;
    order.refundedDepositAmount = totalRefunded;
    order.deductedDepositAmount = totalDeducted;
    order.rentalStatus = isFinalReceipt ? 'returned' : 'partially_returned';
    if (isFinalReceipt) {
      order.actualReturnedAt = now;
    } else {
      order.returnVideo = null;
      order.returnReceivedVideo = null;
    }

    if (totalDeducted === 0) {
      order.depositStatus = 'refunded';
    } else if (totalRefunded > 0) {
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
  ['renting', 'partially_returned', 'overdue'].includes(order.rentalStatus);

const remainingLockedDepositOf = order =>
  Math.max(
    0,
    Number(order.depositAmount || 0) -
      Number(order.refundedDepositAmount || 0) -
      Number(order.deductedDepositAmount || 0)
  );

/**
 * Tổng hợp tiến độ đã trả / còn lại trên từng dòng RentalOrderDetail
 */
export async function getRentalReturnProgress(orderId, session = null) {
  const rawDetails = await RentalOrderDetail.find({ rentalOrderId: orderId })
    .sort({ _id: 1 })
    .session(session)
    .lean();

  const variantIds = [...new Set(rawDetails.map((d) => d.variantId).filter(Boolean))];
  const variants = variantIds.length
    ? await ProductVariant.find({ _id: { $in: variantIds } })
        .select('variantName sku size color productId')
        .populate({ path: 'productId', select: 'name productCode images image' })
        .session(session)
        .lean()
    : [];
  const variantById = new Map(variants.map((v) => [String(v._id), v]));

  // Giữ nguyên ObjectId gốc nếu ProductVariant không tồn tại để không mất variantId khi nhả giữ chỗ
  const details = rawDetails.map((d) => ({
    ...d,
    rawVariantId: d.variantId,
    variantId: variantById.get(String(d.variantId)) || d.variantId,
  }));

  const detailIds = details.map((d) => d._id);
  const [completedReturns, orderItems] = await Promise.all([
    RentalReturn.find({ rentalOrderId: orderId, returnStatus: 'completed' })
      .select('_id')
      .session(session)
      .lean(),
    detailIds.length
      ? RentalOrderItem.find({ rentalOrderDetailId: { $in: detailIds } })
          .session(session)
          .lean()
      : Promise.resolve([]),
  ]);

  const returnIds = completedReturns.map((r) => r._id);
  const returnDetails = returnIds.length
    ? await RentalReturnDetail.find({ rentalReturnId: { $in: returnIds } })
        .session(session)
        .lean()
    : [];

  const returnedByDetail = new Map();
  for (const rd of returnDetails) {
    if (rd.rentalOrderDetailId) {
      const k = String(rd.rentalOrderDetailId);
      returnedByDetail.set(k, (returnedByDetail.get(k) || 0) + Number(rd.quantityReturned || 1));
    }
  }

  const orderItemsByDetail = new Map();
  for (const oi of orderItems) {
    const k = String(oi.rentalOrderDetailId);
    if (!orderItemsByDetail.has(k)) orderItemsByDetail.set(k, []);
    orderItemsByDetail.get(k).push(oi);
  }

  const progressByDetailId = new Map();
  let totalQuantity = 0;
  let totalReturnedQuantity = 0;

  for (const d of details) {
    const k = String(d._id);
    const qty = Number(d.quantity || 1);
    let returnedQty = returnedByDetail.get(k);
    if (returnedQty == null) {
      // Fallback dữ liệu cũ chưa ghi rentalOrderDetailId trên RentalReturnDetail
      const rows = orderItemsByDetail.get(k) || [];
      returnedQty = rows.filter((r) => ['returned', 'missing'].includes(r.status)).length;
    }
    returnedQty = Math.min(qty, Math.max(0, returnedQty));
    const remainingQty = Math.max(0, qty - returnedQty);
    totalQuantity += qty;
    totalReturnedQuantity += returnedQty;
    progressByDetailId.set(k, {
      detail: d,
      quantity: qty,
      returnedQuantity: returnedQty,
      remainingQuantity: remainingQty,
    });
  }

  return {
    details,
    progressByDetailId,
    totalQuantity,
    totalReturnedQuantity,
    totalRemainingQuantity: Math.max(0, totalQuantity - totalReturnedQuantity),
  };
}

/**
 * Kiểm tra & chuẩn hóa danh sách món thuê được chọn gửi thu hồi qua GHN
 */
const calcUnitDeposit = (detail, orderDepositAmount, rawTotalRentalFee) => {
  if (Number(detail.depositPerUnit || 0) > 0) return Number(detail.depositPerUnit);
  if (rawTotalRentalFee > 0 && Number(detail.quantity || 0) > 0) {
    return Math.round((Number(orderDepositAmount || 0) * (Number(detail.lineTotal || 0) / rawTotalRentalFee)) / detail.quantity);
  }
  return 0;
};

export async function findCurrentReturnShipment(orderId, rentalStatus, session = null) {
  const rawShipment = await OrderShipment.findOne({
    orderId,
    orderType: 'rental',
    shipmentType: 'return',
  })
    .sort({ createdAt: -1 })
    .session(session)
    .lean();

  const settledLatestShipment = rawShipment?.shipmentStatus === 'delivered'
    ? await RentalReturn.exists({
        rentalOrderId: orderId,
        shipmentId: rawShipment._id,
        returnStatus: 'completed',
      }).session(session)
    : false;

  const shipment = settledLatestShipment && rentalStatus === 'partially_returned'
    ? null
    : rawShipment;

  return { shipment, rawShipment, settledLatestShipment: Boolean(settledLatestShipment) };
}

export async function prepareRentalReturnRequest(order, { requestedItems = null } = {}) {
  if (!returnable(order)) {
    throw new ServiceError(
      400,
      `Không thể tạo đơn thu hồi đồ cho đơn thuê ở trạng thái "${order.rentalStatus}".`
    );
  }

  const progress = await getRentalReturnProgress(order._id);
  if (!progress.details.length) {
    throw new ServiceError(409, 'Đơn thuê chưa có chi tiết sản phẩm.');
  }
  if (progress.totalRemainingQuantity <= 0) {
    throw new ServiceError(409, 'Đơn thuê đã hoàn trả đủ tất cả trang phục.');
  }

  const rawSelection = Array.isArray(requestedItems) && requestedItems.length > 0
    ? requestedItems
    : [...progress.progressByDetailId.values()]
        .filter((p) => p.remainingQuantity > 0)
        .map((p) => ({
          rentalOrderDetailId: String(p.detail._id),
          quantityReturned: p.remainingQuantity,
        }));

  const mergedQtyByDetail = new Map();
  for (const row of rawSelection) {
    const dId = String(row?.rentalOrderDetailId || row?.detailId || row?.id || '').trim();
    const entry = progress.progressByDetailId.get(dId);
    if (!entry) {
      throw new ServiceError(400, 'Trang phục chọn trả không thuộc đơn thuê này.');
    }
    const qty = Number(row?.quantityReturned ?? row?.quantity);
    if (!Number.isSafeInteger(qty) || qty < 1) {
      throw new ServiceError(400, 'Số lượng trả phải là số nguyên dương.');
    }
    const nextQty = (mergedQtyByDetail.get(dId) || 0) + qty;
    if (nextQty > entry.remainingQuantity) {
      throw new ServiceError(400, 'Số lượng hoàn trả vượt quá số lượng còn chưa trả của đơn thuê.');
    }
    mergedQtyByDetail.set(dId, nextQty);
  }

  if (!mergedQtyByDetail.size) {
    throw new ServiceError(400, 'Vui lòng chọn ít nhất 1 trang phục để thu hồi.');
  }

  const remainingLockedDeposit = remainingLockedDepositOf(order);
  const rawTotalRentalFee = progress.details.reduce((s, d) => s + Number(d.lineTotal || 0), 0);
  const selectedQtySum = [...mergedQtyByDetail.values()].reduce((s, q) => s + q, 0);
  const isFinalBatch = selectedQtySum >= progress.totalRemainingQuantity;

  const ghnItems = [];
  const snapshotItems = [];
  let expectedDepositRefund = 0;

  for (const [dId, qty] of mergedQtyByDetail.entries()) {
    const { detail } = progress.progressByDetailId.get(dId);
    const unitDep = calcUnitDeposit(detail, order.depositAmount, rawTotalRentalFee);
    expectedDepositRefund += unitDep * qty;

    const name = detail.variantId?.variantName || detail.variantId?.productId?.name || 'Trang phục Vestora';
    const sku = detail.variantId?.sku || detail.variantId?.productId?.productCode || 'SKU-VESTORA';
    const price = Number(detail.unitRentalFee || 0);

    ghnItems.push({ name, sku, quantity: qty, price });
    snapshotItems.push({
      rentalOrderDetailId: detail._id,
      name,
      sku,
      size: detail.variantId?.size || '',
      color: detail.variantId?.color || '',
      quantity: qty,
      price,
    });
  }

  expectedDepositRefund = isFinalBatch
    ? remainingLockedDeposit
    : Math.min(remainingLockedDeposit, Math.max(0, Math.round(expectedDepositRefund)));

  return {
    isFinalBatch,
    expectedDepositRefund,
    ghnItems,
    snapshotItems,
    progress,
  };
}

const roleKey = (user) =>
  String(user?.Role || user?.role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace('brandmanager', 'branchmanager');

const staffRole = (user) =>
  ['admin', 'owner', 'shopowner', 'branchmanager'].includes(roleKey(user));

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

  const [progress, { shipment }] = await Promise.all([
    getRentalReturnProgress(id),
    findCurrentReturnShipment(id, order.rentalStatus),
  ]);

  const videoPermissions = await evidencePermissions(
    order,
    user,
    manager,
    shipment
  );

  const shop =
    order.locationId?.shopId || order.locationId || {};

  const batchQtyByDetail = new Map();
  if (shipment && ['preparing', 'shipped', 'delivered'].includes(shipment.shipmentStatus) && Array.isArray(shipment.items) && shipment.items.length > 0) {
    for (const si of shipment.items) {
      if (si.rentalOrderDetailId) {
        const k = String(si.rentalOrderDetailId);
        batchQtyByDetail.set(k, (batchQtyByDetail.get(k) || 0) + Number(si.quantity || 1));
      }
    }
  }

  const hasExplicitBatch = batchQtyByDetail.size > 0;
  const displayItems = progress.details
    .map((d) => {
      const p = progress.progressByDetailId.get(String(d._id));
      const batchQty = hasExplicitBatch ? (batchQtyByDetail.get(String(d._id)) || 0) : p.remainingQuantity;
      return {
        id: d._id,
        detailId: d._id,
        name: d.variantId?.productId?.name || 'Trang phục',
        sku: d.variantId?.sku || '',
        size: d.variantId?.size || '',
        color: d.variantId?.color || '',
        quantity: order.rentalStatus === 'returned' ? d.quantity : batchQty,
        totalQuantity: d.quantity,
        returnedQuantity: p.returnedQuantity,
        remainingQuantity: p.remainingQuantity,
        depositPerUnit: d.depositPerUnit || 0,
        image:
          d.variantId?.productId?.images?.[0] ||
          d.variantId?.productId?.image ||
          '',
      };
    })
    .filter((it) => order.rentalStatus === 'returned' || it.quantity > 0);

  const isBM = roleKey(user) === 'branchmanager';

  const readEvidenceField = (field) => {
    if (
      ['returnVideo', 'returnReceivedVideo'].includes(field) &&
      shipment &&
      ['cancelled', 'failed'].includes(shipment.shipmentStatus)
    ) {
      return null;
    }
    return signedEvidence(shipment?.[field] || order[field]);
  };

  return {
    orderCode: order.orderCode,
    rentalStatus: order.rentalStatus,
    depositStatus: order.depositStatus,
    depositAmount: order.depositAmount,
    refundedDepositAmount: order.refundedDepositAmount || 0,
    deductedDepositAmount: order.deductedDepositAmount || 0,
    remainingDepositAmount: remainingLockedDepositOf(order),
    isPartialOrder: order.rentalStatus === 'partially_returned',
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

    items: displayItems,
    totalRemainingQuantity: progress.totalRemainingQuantity,

    ...Object.fromEntries(
      Object.values(EVIDENCE_FIELDS).map(field => [
        field,
        readEvidenceField(field),
      ])
    ),
    videoPermissions,
    shipment,
    canManage: isBM,
    simulatorEnabled: returnSimulatorEnabled() && isBM,
    canRequest: returnable(order) && progress.totalRemainingQuantity > 0 && (!shipment || ['cancelled', 'failed'].includes(shipment.shipmentStatus)),
    completed: order.rentalStatus === 'returned',
    refundedAmount:
      order.depositStatus === 'refunded'
        ? order.depositAmount
        : (order.refundedDepositAmount > 0 ? order.refundedDepositAmount : null),
  };
}

export async function checkEvidenceAccess(user, id, kind) {
  const { order, manager } = await accessReturnOrder(user, id);

  if (!Object.hasOwn(EVIDENCE_FIELDS, kind)) {
    throw new ServiceError(400, 'Loại video không hợp lệ.');
  }

  const { shipment } = await findCurrentReturnShipment(id, order.rentalStatus);

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

  if (['return', 'return-received'].includes(kind) && shipment) {
    if (shipment[field]) {
      throw new ServiceError(
        409,
        'Video đã được lưu cho đợt trả này, không ghi đè bằng chứng.'
      );
    }
    return field;
  }

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

    if (
      wrongWallet ||
      hold.amount !== Number(order.depositAmount || 0) ||
      remainingLockedDepositOf(order) < amount ||
      wrongReference
    ) {
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
    rentalStatus: { $ne: 'returned' },
    depositStatus: {
      $in: ['held', 'partially_refunded', 'partially_deducted'],
    },
  })
    .select('depositAmount depositStatus refundedDepositAmount deductedDepositAmount')
    .session(session);

  if (others.some((row) => !Number.isSafeInteger(row.depositAmount))) {
    throw new ServiceError(
      409,
      'Ví có khoản cọc đang quyết toán một phần; cần đối soát số tiền còn giữ.'
    );
  }

  const totalHeld = others.reduce(
    (total, row) => total + remainingLockedDepositOf(row),
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

async function releasePartialRentalReservations(order, releaseByVariant, session) {
  const reservations = await InventoryReservation.find({
    orderId: order._id,
    orderType: 'rental',
    status: 'active',
  }).session(session);

  if (!reservations.length) return;

  const actualByVariant = new Map();
  for (const r of reservations) {
    const k = String(r.variantId);
    actualByVariant.set(k, (actualByVariant.get(k) || 0) + Number(r.quantity || 0));
  }

  for (const [variantId, qtyToRelease] of releaseByVariant.entries()) {
    if (qtyToRelease <= 0) continue;
    if ((actualByVariant.get(variantId) || 0) < qtyToRelease) {
      throw new ServiceError(409, 'Giữ chỗ tồn kho không khớp số lượng trang phục cần trả.');
    }
    let rem = qtyToRelease;
    for (const resv of reservations) {
      if (String(resv.variantId) !== variantId || rem <= 0 || resv.status !== 'active') continue;
      const take = Math.min(Number(resv.quantity || 0), rem);
      const nextQty = Number(resv.quantity || 0) - take;
      await InventoryReservation.updateOne(
        { _id: resv._id },
        nextQty <= 0 ? { $set: { status: 'released', quantity: 0 } } : { $set: { quantity: nextQty } },
        { session }
      );
      resv.quantity = nextQty;
      if (nextQty <= 0) resv.status = 'released';
      rem -= take;
    }
  }

  await releaseReserved({ locationId: order.locationId, reservedByVariant: releaseByVariant }, session);
}

// Nghiệm thu KCS & hoàn cọc (hỗ trợ cả GHN thật và mô phỏng, cả trả từng phần lẫn toàn đơn)
export async function completeSimulatedReturn(user, id, options = {}) {
  if (roleKey(user) !== 'branchmanager') {
    throw new ServiceError(
      403,
      'Chỉ có Quản lý chi nhánh (Branch Manager) mới có quyền hoàn tất trả đồ và hoàn cọc.'
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

    if (order.rentalStatus === 'returned') {
      const previous = await WalletTransaction.findOne({
        referenceId: order._id,
        referenceType: 'RentalOrder',
        transactionType: 'deposit_refund',
      })
        .sort({ createdAt: -1 })
        .session(session);

      return {
        refundedAmount: order.refundedDepositAmount || previous?.amount || 0,
        alreadyCompleted: true,
      };
    }

    const shipment = await OrderShipment.findOne({
      orderId: id,
      orderType: 'rental',
      shipmentType: 'return',
      shipmentStatus: 'delivered',
    })
      .sort({ createdAt: -1 })
      .session(session);

    if (!shipment || !returnable(order)) {
      throw new ServiceError(
        409,
        'Đồ chưa được giao về shop.'
      );
    }

    // Chống bấm hoàn tất trùng trên cùng 1 vận đơn đợt trả
    const existingBatchReceipt = await RentalReturn.findOne({
      rentalOrderId: id,
      shipmentId: shipment._id,
      returnStatus: 'completed',
    }).session(session);

    if (existingBatchReceipt) {
      return {
        refundedAmount: existingBatchReceipt.depositRefunded || 0,
        alreadyCompleted: true,
      };
    }

    const hasPriorCompletedReturn = await RentalReturn.exists({
      rentalOrderId: id,
      returnStatus: 'completed',
    }).session(session);

    const hasReceiptVideo =
      Boolean(shipment.returnReceivedVideo) ||
      (!hasPriorCompletedReturn && order.rentalStatus !== 'partially_returned' && Boolean(order.returnReceivedVideo));
    if (!hasReceiptVideo) {
      throw new ServiceError(
        422,
        'Shop phải tải video nhận đồ trả trước khi hoàn tất và hoàn cọc.'
      );
    }

    const progress = await getRentalReturnProgress(id, session);
    if (!progress.details.length) {
      throw new ServiceError(409, 'Đơn chưa có chi tiết sản phẩm.');
    }

    const detailMap = new Map(progress.details.map(d => [String(d._id), d]));
    const batchLines = [];

    if (Array.isArray(shipment.items) && shipment.items.length > 0) {
      for (const si of shipment.items) {
        if (!si.rentalOrderDetailId) continue;
        const dId = String(si.rentalOrderDetailId);
        const detail = detailMap.get(dId);
        const prog = progress.progressByDetailId.get(dId);
        const qty = Number(si.quantity || 1);
        if (!detail || !prog || qty < 1 || qty > prog.remainingQuantity) {
          throw new ServiceError(409, 'Danh sách trang phục trong vận đơn trả không khớp số lượng còn lại của đơn.');
        }
        batchLines.push({ detail, quantity: qty });
      }
    }

    if (!batchLines.length) {
      for (const p of progress.progressByDetailId.values()) {
        if (p.remainingQuantity > 0) {
          batchLines.push({ detail: p.detail, quantity: p.remainingQuantity });
        }
      }
    }

    if (!batchLines.length) {
      throw new ServiceError(409, 'Không còn trang phục nào chưa trả trên đơn thuê này.');
    }

    const batchQtySum = batchLines.reduce((s, l) => s + l.quantity, 0);
    const isFinalBatch = batchQtySum >= progress.totalRemainingQuantity;
    const remainingLockedDeposit = remainingLockedDepositOf(order);

    if (
      !Number.isSafeInteger(remainingLockedDeposit) ||
      remainingLockedDeposit < 0 ||
      order.paymentStatus !== 'paid' ||
      (remainingLockedDeposit > 0 && !['held', 'partially_refunded', 'partially_deducted'].includes(order.depositStatus))
    ) {
      throw new ServiceError(
        409,
        'Trạng thái thanh toán hoặc tiền cọc không hợp lệ.'
      );
    }

    const rawTotalRentalFee = progress.details.reduce((s, d) => s + Number(d.lineTotal || 0), 0);
    let batchDeposit = 0;
    let batchRentalFee = 0;

    for (const line of batchLines) {
      const { detail, quantity } = line;
      const lineRentalShare = Number(detail.quantity || 1) > 0
        ? (Number(detail.lineTotal || 0) * quantity) / Number(detail.quantity || 1)
        : 0;
      batchRentalFee += lineRentalShare;

      const unitDep = calcUnitDeposit(detail, order.depositAmount, rawTotalRentalFee);
      batchDeposit += unitDep * quantity;
    }

    batchDeposit = isFinalBatch
      ? remainingLockedDeposit
      : Math.min(remainingLockedDeposit, Math.max(0, Math.round(batchDeposit)));

    const now = new Date();
    const effectiveReturnDate = shipment.shippedAt || shipment.deliveredAt || now;
    const { lateDays, lateFee } = calculateLateFee(order, effectiveReturnDate, Math.round(batchRentalFee));
    const rawDamageFee =
      options.damageFee === undefined || options.damageFee === null || options.damageFee === ''
        ? 0
        : Number(options.damageFee);
    if (!Number.isSafeInteger(rawDamageFee) || rawDamageFee < 0) {
      throw new ServiceError(400, 'Phí hư hỏng phải là số nguyên không âm hợp lệ.');
    }
    const totalDamageFee = rawDamageFee;
    const totalDeductions = lateFee + totalDamageFee;

    const deductFromLocked = Math.min(remainingLockedDeposit, totalDeductions);
    const refundedFromBatch = isFinalBatch
      ? Math.max(0, remainingLockedDeposit - totalDeductions)
      : Math.max(0, batchDeposit - totalDeductions);
    const lockedToUnlock = isFinalBatch
      ? remainingLockedDeposit
      : Math.min(remainingLockedDeposit, refundedFromBatch + deductFromLocked);
    const excessDebt = isFinalBatch ? Math.max(0, totalDeductions - remainingLockedDeposit) : 0;

    const newRefundedTotal = Number(order.refundedDepositAmount || 0) + refundedFromBatch;
    const newDeductedTotal = Number(order.deductedDepositAmount || 0) + deductFromLocked;

    let nextDepositStatus;
    if (!isFinalBatch) {
      nextDepositStatus = newRefundedTotal > 0 ? 'partially_refunded' : (newDeductedTotal > 0 ? 'partially_deducted' : order.depositStatus);
    } else if (newDeductedTotal === 0) {
      nextDepositStatus = 'refunded';
    } else if (newRefundedTotal > 0) {
      nextDepositStatus = 'partially_deducted';
    } else {
      nextDepositStatus = 'forfeited';
    }

    const orderUpdateSet = {
      rentalStatus: isFinalBatch ? 'returned' : 'partially_returned',
      depositStatus: nextDepositStatus,
      refundedDepositAmount: newRefundedTotal,
      deductedDepositAmount: newDeductedTotal,
      ...(isFinalBatch
        ? { actualReturnedAt: now }
        : { returnVideo: null, returnReceivedVideo: null }),
    };
    if (excessDebt > 0) {
      orderUpdateSet.note = order.note
        ? `${order.note}; Dư nợ đền bù vượt cọc: ${excessDebt.toLocaleString('vi-VN')} đ`
        : `Dư nợ đền bù vượt cọc: ${excessDebt.toLocaleString('vi-VN')} đ`;
    }

    const claimed = await RentalOrder.updateOne(
      {
        _id: id,
        rentalStatus: order.rentalStatus,
        depositStatus: order.depositStatus,
      },
      {
        $set: orderUpdateSet,
        $inc: { returnFlowVersion: 1 },
      },
      { session }
    );

    if (claimed.matchedCount !== 1) {
      throw new ServiceError(
        409,
        'Đơn vừa được quyết toán hoặc vừa thay đổi.'
      );
    }

    const [receipt] = await RentalReturn.create(
      [
        {
          returnCode: generateReturnCode(),
          rentalOrderId: id,
          shipmentId: shipment._id,
          receivedBy: user._id,
          returnStatus: 'completed',
          returnedAt: now,
          lateFee,
          damageFee: totalDamageFee,
          depositRefunded: refundedFromBatch,
          note:
            options.note ||
            (isFinalBatch
              ? 'Shop xác nhận nhận đủ đồ thuê còn lại và hoàn tất quyết toán cọc.'
              : `Shop xác nhận nhận ${batchQtySum} trang phục đợt trả một phần; hoàn ${refundedFromBatch.toLocaleString('vi-VN')}đ tiền cọc.`),
        },
      ],
      { session }
    );

    const allDetailIds = progress.details.map(d => d._id);
    const allOrderItems = await RentalOrderItem.find({
      rentalOrderDetailId: { $in: allDetailIds },
    }).session(session);

    const handedOverByDetail = new Map();
    for (const row of allOrderItems) {
      if (row.status === 'handed_over') {
        const k = String(row.rentalOrderDetailId);
        if (!handedOverByDetail.has(k)) handedOverByDetail.set(k, []);
        handedOverByDetail.get(k).push(row);
      }
    }

    if (allOrderItems.length > 0) {
      const selectedRows = [];
      for (const { detail, quantity } of batchLines) {
        const candidates = handedOverByDetail.get(String(detail._id)) || [];
        if (candidates.length < quantity) {
          throw new ServiceError(409, 'Hiện vật đã bàn giao không đủ khớp số lượng hoàn trả.');
        }
        selectedRows.push(...candidates.slice(0, quantity).map((row) => ({ row, detail })));
      }

      const inventory = await InventoryItem.find({
        _id: { $in: selectedRows.map(({ row }) => row.itemId) },
      }).session(session);

      if (inventory.length !== selectedRows.length) {
        throw new ServiceError(409, 'Thiếu hiện vật trong kho.');
      }

      const invById = new Map(inventory.map((it) => [String(it._id), it]));
      await returnItems(
        inventory.map(item => ({
          item,
          inspectionResult: 'ok',
        })),
        session
      );

      await RentalReturnDetail.insertMany(
        selectedRows.map(({ row, detail }) => ({
          rentalReturnId: receipt._id,
          rentalOrderDetailId: detail._id,
          quantityReturned: 1,
          itemId: row.itemId,
          inspectionResult: 'ok',
        })),
        { session }
      );

      await StockMovement.insertMany(
        selectedRows.map(({ row }) => {
          const item = invById.get(String(row.itemId));
          return {
            itemId: item._id,
            variantId: item.variantId,
            locationId: item.locationId,
            storageId: null,
            movementType: 'rental_return',
            quantityChange: 1,
            referenceType: 'rental_return',
            referenceId: receipt._id,
            createdBy: user._id,
          };
        }),
        { session }
      );

      await RentalOrderItem.updateMany(
        { _id: { $in: selectedRows.map(({ row }) => row._id) } },
        { $set: { status: 'returned' } },
        { session }
      );
    } else {
      const releaseByVariant = new Map();
      for (const { detail, quantity } of batchLines) {
        const vId = String(detail.rawVariantId || detail.variantId?._id || detail.variantId);
        releaseByVariant.set(vId, (releaseByVariant.get(vId) || 0) + quantity);
      }
      await releasePartialRentalReservations(order, releaseByVariant, session);

      await RentalReturnDetail.insertMany(
        batchLines.map(({ detail, quantity }) => ({
          rentalReturnId: receipt._id,
          rentalOrderDetailId: detail._id,
          quantityReturned: quantity,
          itemId: null,
          inspectionResult: 'ok',
        })),
        { session }
      );
    }

    if (lockedToUnlock > 0) {
      const wallet = await Wallet.findOne({
        userId: order.customerId,
      })
        .select('+balanceEncrypted +lockedBalanceEncrypted')
        .session(session);

      await validateDepositHold(order, wallet, lockedToUnlock, session);

      const businessKey = `rental-return:${id}:${receipt._id}`;
      const isZeroRefund = refundedFromBatch === 0 && deductFromLocked > 0;
      const [tx] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: order.customerId,
            businessKey,
            code: generateWalletTxCode(isZeroRefund ? 'ADJ-RNT' : 'REF-RNT'),
            transactionType: isZeroRefund ? 'adjustment' : 'deposit_refund',
            direction: isZeroRefund ? 'debit' : 'credit',
            amount: isZeroRefund ? deductFromLocked : refundedFromBatch,
            status: 'success',
            referenceType: 'RentalOrder',
            referenceId: order._id,
            completedAt: now,
          },
        ],
        { session }
      );

      // Mở khóa đúng phần cọc đợt này; nếu có phạt trễ/hỏng thì trừ vào balanceEncrypted
      const balanceDelta = deductFromLocked > 0 ? -deductFromLocked : 0;
      await changeFunds(
        wallet,
        tx,
        balanceDelta,
        -lockedToUnlock,
        'rental_deposit_settlement',
        session
      );

      await tx.save({ session });
    }

    return {
      refundedAmount: refundedFromBatch,
      lateDays,
      lateFee,
      isPartial: !isFinalBatch,
      alreadyCompleted: false,
    };
  });
}
