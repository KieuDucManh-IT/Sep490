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
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
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

    // 3. Cập nhật trạng thái từng hiện vật kho InventoryItem & RentalOrderItem
    for (const it of items) {
      let nextItemStatus = 'available';
      if (['damaged', 'worn'].includes(it.conditionOnReturn)) {
        nextItemStatus = 'maintenance';
      } else if (it.conditionOnReturn === 'unrepairable') {
        nextItemStatus = 'damaged';
      }

      const invItem = await InventoryItem.findById(it.itemId).session(session);
      if (invItem) {
        invItem.status = nextItemStatus;
        await invItem.save({ session });

        // Ghi nhận StockMovement nhập trả kho thuê
        await StockMovement.create(
          [
            {
              variantId: invItem.variantId,
              itemId: invItem._id,
              locationId: order.locationId,
              movementType: 'rental_return',
              quantityChange: 1,
              referenceType: 'rental_return',
              referenceId: rentalReturn._id,
              createdBy: receivedBy || order.createdBy,
            },
          ],
          { session }
        );

        // Khôi phục InventoryBalance nếu đồ có thể tái sử dụng
        if (nextItemStatus === 'available') {
          await InventoryBalance.updateOne(
            { locationId: order.locationId, variantId: invItem.variantId },
            { $inc: { quantityOnHand: 1 } },
            { session }
          );
        }
      }

      await RentalOrderItem.updateMany(
        { itemId: it.itemId },
        { $set: { status: 'returned' } },
        { session }
      );
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
    throw err;
  } finally {
    if (isInternal) session.endSession();
  }
};
