/**
 * Rental Dispute Service
 * Xử lý khiếu nại đổi trả lỗi ban đầu (Min.de / Vestora 24h SLA)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-010
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-011
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-012
 */

import crypto from 'node:crypto';
import { mongoose } from '../../config/db.js';
import { RentalDispute } from '../../models/sale&rental/RentalDispute.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderItem } from '../../models/sale&rental/RentalOrderItem.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryReservation } from '../../models/warehouse/inventory/InventoryReservation.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { WalletTransaction } from '../../models/finance/WalletTransaction.js';
import { readyWallet, changeFunds } from '../walletService.js';
import {
  createRentalDisputeSchema,
  respondRentalDisputeSchema,
  kcsRentalDisputeSchema,
} from '../../validations/sale&rental/rentalDisputeValidation.js';
import { ServiceError, generateWalletTxCode } from './rentalOrderService.js';

export const generateDisputeCode = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DSP-${dateStr}-${rand}`;
};

/**
 * Tạo khiếu nại đổi trả sản phẩm lỗi ban đầu (24h window)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-010
 */
export const createReturnClaim = async ({
  rentalOrderId,
  customerId,
  reason,
  description,
  evidenceImages,
}) => {
  const validation = createRentalDisputeSchema.safeParse({
    rentalOrderId: String(rentalOrderId),
    reason,
    description,
    evidenceImages,
  });

  if (!validation.success) {
    const errorMsg = validation.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ServiceError(400, `Dữ liệu khiếu nại không hợp lệ: ${errorMsg}`);
  }

  const order = await RentalOrder.findById(rentalOrderId);
  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn thuê');
  }

  if (String(order.customerId) !== String(customerId)) {
    throw new ServiceError(403, 'Bạn không có quyền khiếu nại cho đơn thuê này');
  }

  if (order.rentalStatus !== 'renting') {
    throw new ServiceError(
      422,
      `Chỉ đơn thuê đang trong quá trình thuê (renting) mới có thể gửi khiếu nại đổi trả (hiện tại: ${order.rentalStatus})`
    );
  }

  // Kiểm tra thời điểm bàn giao thực tế (handedOverAt)
  const details = await RentalOrderDetail.find({ rentalOrderId: order._id });
  const detailIds = details.map((d) => d._id);
  const items = await RentalOrderItem.find({ rentalOrderDetailId: { $in: detailIds } });

  const handoverTimestamps = items
    .map((it) => (it.handedOverAt ? new Date(it.handedOverAt).getTime() : null))
    .filter(Boolean);

  const receiptTime = handoverTimestamps.length > 0
    ? Math.min(...handoverTimestamps)
    : new Date(order.updatedAt).getTime();

  const now = Date.now();
  const elapsedHours = (now - receiptTime) / (1000 * 60 * 60);

  // SLA 24h: từ chối nếu quá 24 giờ kể từ thời điểm nhận đồ
  if (elapsedHours > 24) {
    throw new ServiceError(
      422,
      `Đã quá thời hạn 24 giờ (${Math.round(elapsedHours)} giờ đã trôi qua) kể từ khi nhận đồ. Hệ thống từ chối khiếu nại lỗi ban đầu theo Chính sách đổi trả Min.de/Vestora.`
    );
  }

  // Kiểm tra xem đã có khiếu nại đang xử lý cho đơn này chưa (mỗi đơn chỉ được yêu cầu 1 lần)
  const existingDispute = await RentalDispute.findOne({
    rentalOrderId: order._id,
    status: { $in: ['pending_review', 'approved', 'item_returned', 'resolved'] },
  });

  if (existingDispute) {
    throw new ServiceError(
      409,
      `Đơn thuê đã có khiếu nại đang được xử lý (mã: ${existingDispute.disputeCode})`
    );
  }

  const disputeCode = generateDisputeCode();
  const dispute = await RentalDispute.create({
    disputeCode,
    rentalOrderId: order._id,
    customerId,
    reason,
    description,
    evidenceImages,
    status: 'pending_review',
  });

  return {
    success: true,
    message: 'Gửi yêu cầu khiếu nại đổi trả thành công. Bộ phận CSKH sẽ phản hồi trong vòng 72 giờ.',
    dispute,
  };
};

/**
 * CSKH phản hồi phê duyệt hoặc từ chối khiếu nại (72h SLA)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-011
 */
export const respondReturnClaim = async ({
  disputeId,
  decision,
  cskhNote,
  cskhStaffId,
}) => {
  const validation = respondRentalDisputeSchema.safeParse({
    disputeId: String(disputeId),
    decision,
    cskhNote,
  });

  if (!validation.success) {
    throw new ServiceError(400, 'Dữ liệu phản hồi khiếu nại không hợp lệ');
  }

  const dispute = await RentalDispute.findById(disputeId);
  if (!dispute) {
    throw new ServiceError(404, 'Không tìm thấy khiếu nại đổi trả');
  }

  if (dispute.status !== 'pending_review') {
    throw new ServiceError(
      422,
      `Chỉ khiếu nại ở trạng thái chờ duyệt (pending_review) mới có thể phản hồi (hiện tại: ${dispute.status})`
    );
  }

  const now = new Date();
  dispute.cskhRespondedAt = now;
  dispute.cskhNote = cskhNote;

  if (decision === 'approved') {
    dispute.status = 'approved';
    // Hạn chót gửi hàng hoàn về: 10 ngày kể từ ngày duyệt
    dispute.returnDeadline = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  } else {
    dispute.status = 'rejected';
  }

  await dispute.save();

  return {
    success: true,
    message: decision === 'approved'
      ? 'Đã chấp thuận yêu cầu đổi trả. Khách hàng có 10 ngày để gửi lại trang phục.'
      : 'Đã từ chối yêu cầu đổi trả.',
    dispute,
  };
};

/**
 * Xác nhận tiếp nhận đồ hoàn về chi nhánh/kho (trong hạn 10 ngày)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-011
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-012
 */
export const confirmReturnReceived = async ({ disputeId, trackingNumber = '' }) => {
  const dispute = await RentalDispute.findById(disputeId);
  if (!dispute) {
    throw new ServiceError(404, 'Không tìm thấy khiếu nại đổi trả');
  }

  if (dispute.status !== 'approved') {
    throw new ServiceError(
      422,
      `Chỉ khiếu nại đã được phê duyệt mới có thể tiếp nhận đồ hoàn (hiện tại: ${dispute.status})`
    );
  }

  // Kiểm tra hạn 10 ngày
  if (dispute.returnDeadline && new Date() > new Date(dispute.returnDeadline)) {
    dispute.status = 'expired';
    await dispute.save();
    throw new ServiceError(
      422,
      'Đã quá 10 ngày kể từ khi xác nhận đổi trả mà chưa nhận được hàng. Khiếu nại đã tự động hết hạn.'
    );
  }

  dispute.status = 'item_returned';
  if (trackingNumber) dispute.returnTrackingNumber = trackingNumber;
  await dispute.save();

  return {
    success: true,
    message: 'Đã tiếp nhận kiện hàng hoàn về. Chuyển sang bước thẩm định KCS (tối đa 7 ngày).',
    dispute,
  };
};

/**
 * Nghiệm thu KCS & Quyết toán hoàn tiền khiếu nại (100% tiền thuê + cọc)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-011
 */
export const completeDisputeKCS = async ({
  disputeId,
  kcsResult,
  refundMethod = 'wallet_balance',
  note = '',
  operatorId,
  session: externalSession = null,
  deps = {},
}) => {
  const validation = kcsRentalDisputeSchema.safeParse({
    disputeId: String(disputeId),
    kcsResult,
    refundMethod,
    note,
  });

  if (!validation.success) {
    throw new ServiceError(400, 'Dữ liệu thẩm định KCS không hợp lệ');
  }

  const dispute = await RentalDispute.findById(disputeId);
  if (!dispute) {
    throw new ServiceError(404, 'Không tìm thấy khiếu nại');
  }

  if (dispute.status !== 'item_returned') {
    throw new ServiceError(
      422,
      `Chỉ khiếu nại đã nhận lại đồ (item_returned) mới có thể nghiệm thu KCS (hiện tại: ${dispute.status})`
    );
  }

  const order = await RentalOrder.findById(dispute.rentalOrderId);
  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn thuê liên kết');
  }

  const session = externalSession || (await mongoose.startSession());
  const isInternal = !externalSession;
  if (isInternal) session.startTransaction();

  try {
    dispute.kcsInspectedAt = new Date();
    dispute.kcsResult = kcsResult;
    dispute.refundMethod = refundMethod;

    if (kcsResult === 'valid') {
      // Khiếu nại hợp lệ: Hoàn 100% tiền thuê + Giải phóng 100% tiền cọc
      const totalRefund = order.rentalFee + order.depositAmount;
      dispute.status = 'resolved';
      dispute.refundAmount = totalRefund;
      dispute.refundStatus = 'completed';

      // Cập nhật đơn thuê sang returned
      order.rentalStatus = 'returned';
      order.paymentStatus = 'refunded';
      order.depositStatus = 'refunded';
      order.actualReturnedAt = new Date();
      await order.save({ session });

      // Nếu hoàn vào Ví
      if (refundMethod === 'wallet_balance') {
        const getWallet = deps.readyWallet || readyWallet;
        const modifyFunds = deps.changeFunds || changeFunds;

        const wallet = await getWallet(order.customerId);
        const [refundTx] = await WalletTransaction.create(
          [
            {
              walletId: wallet._id,
              userId: order.customerId,
              code: generateWalletTxCode('DSP-REF'),
              transactionType: 'refund',
              direction: 'credit',
              amount: order.rentalFee,
              currency: 'VND',
              status: 'success',
              referenceType: 'RentalDispute',
              referenceId: dispute._id,
            },
          ],
          { session }
        );

        // balanceDelta = +order.rentalFee (hoàn lại toàn bộ tiền thuê vào ví)
        // lockedDelta = -order.depositAmount (mở khóa toàn bộ tiền cọc đã giữ)
        await modifyFunds(
          wallet,
          refundTx,
          order.rentalFee,
          -order.depositAmount,
          'dispute_valid_full_refund',
          session
        );
      }

      // Khôi phục trạng thái hiện vật kho sang maintenance/available
      const details = await RentalOrderDetail.find({ rentalOrderId: order._id });
      const items = await RentalOrderItem.find({
        rentalOrderDetailId: { $in: details.map((d) => d._id) },
      });
      const itemIds = items.map((it) => it.itemId);

      await InventoryItem.updateMany(
        { _id: { $in: itemIds } },
        { $set: { status: 'maintenance' } }, // Trang phục lỗi chuyển sang bảo trì/giặt là
        { session }
      );
    } else {
      // Khiếu nại không hợp lệ (không phát hiện lỗi hoặc do lỗi người dùng)
      dispute.status = 'rejected';
      dispute.refundStatus = 'rejected';
    }

    await dispute.save({ session });

    if (isInternal) await session.commitTransaction();

    return {
      success: true,
      message: kcsResult === 'valid'
        ? `Thẩm định KCS hợp lệ. Đã quyết toán hoàn 100% tiền thuê (${order.rentalFee.toLocaleString('vi-VN')} đ) và giải phóng cọc (${order.depositAmount.toLocaleString('vi-VN')} đ).`
        : 'Thẩm định KCS không hợp lệ. Đã từ chối khiếu nại hoàn tiền.',
      dispute,
    };
  } catch (err) {
    if (isInternal) await session.abortTransaction();
    throw err;
  } finally {
    if (isInternal) session.endSession();
  }
};
