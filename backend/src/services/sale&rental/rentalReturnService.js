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
import { returnItems, withStatus } from '../warehouse/orderStockService.js';
import { refreshOutOfStockStatus } from '../warehouse/productStockStatusService.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { WalletTransaction } from '../../models/finance/WalletTransaction.js';
import { readyWallet, changeFunds } from '../walletService.js';
import {
  createRentalReturnSchema,
  settleDepositRefundSchema,
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
  const { lateDays, lateFee } = calculateLateFee(order, now);

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
      conditionOnReturn: it.conditionOnReturn,
      itemReturnStatus: it.itemReturnStatus || 'accepted',
      damageFee: Number(it.damageFee || 0),
      note: it.note || '',
    }));
    await RentalReturnDetail.insertMany(returnDetails, { session });

    // 3. TASK-010: cập nhật hiện vật qua itemStateService theo bảng quy đổi (người dùng chốt 17/11):
    //    new/good → available; worn/damaged → unavailable; unrepairable → unavailable + condition unrepairable.
    //    Không dùng `maintenance` ở chi nhánh (bảo trì chỉ ở kho tổng). Helper: renting −1, onHand +1, unavailable +1 nếu cần.
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
      return { item: invItem, conditionOnReturn: it.conditionOnReturn };
    });
    await returnItems(entries, session);

    await StockMovement.insertMany(entries.map(({ item }) => ({
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

    await RentalOrderItem.updateMany(
      { _id: { $in: handedOver.map((row) => row._id) } },
      { $set: { status: 'returned' } },
      { session }
    );

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

    // TASK-012: Trả hàng → tồn kho thay đổi → kiểm tra lại hết hàng
    // - Hàng new/good: available tăng → isOutOfStock có thể thành false
    // - Hàng worn/damaged/unrepairable: unavailable tăng → không ảnh hưởng available, nhưng vẫn refresh để chắc chắn
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
