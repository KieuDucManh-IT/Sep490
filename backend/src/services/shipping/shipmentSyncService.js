import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import * as ghnService from './ghnService.js';
import { mapGhnStatus } from './ghnStatusMapper.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Đồng bộ thời gian thực 1 vận đơn cụ thể trực tiếp từ GHN API vào MongoDB Atlas
 * @param {string|Object} trackingCodeOrShipment - Mã GHN/Mã đơn hoặc Document OrderShipment
 * @param {boolean} force - Bỏ qua giới hạn thời gian sync tối thiểu
 */
export const syncSingleShipmentFromGHN = async (trackingCodeOrShipment, force = false) => {
  try {
    let shipment = null;
    if (typeof trackingCodeOrShipment === 'string') {
      const code = trackingCodeOrShipment.trim();
      shipment = await OrderShipment.findOne({
        $or: [
          { trackingCode: code },
          { orderCode: code },
        ],
      }).sort({ createdAt: -1 });
    } else if (trackingCodeOrShipment && trackingCodeOrShipment._id) {
      shipment = await OrderShipment.findById(trackingCodeOrShipment._id);
    }

    if (!shipment || !shipment.trackingCode) {
      return shipment;
    }

    // Tránh spam request lên GHN nếu vừa mới sync trong 3 giây qua (trừ khi có flag force)
    if (!force && shipment.lastSyncedAt && Date.now() - new Date(shipment.lastSyncedAt).getTime() < 3000) {
      return shipment;
    }

    // Bỏ qua mã thử nghiệm hoặc mã nội bộ (TRK-..., SHP-...): không quét GHN
    if (shipment.trackingCode.startsWith('TRK-') || shipment.trackingCode.startsWith('SHP-')) {
      await OrderShipment.updateOne(
        { _id: shipment._id },
        {
          $set: {
            shipmentStatus: 'cancelled',
            lastSyncedAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: 'cancelled',
              description: 'Vận đơn nội bộ/thử nghiệm đã hủy',
              timestamp: new Date(),
            },
          },
        }
      );
      shipment.shipmentStatus = 'cancelled';
      shipment.lastSyncedAt = new Date();
      return shipment;
    }

    let ghnData;
    try {
      ghnData = await ghnService.getGHNOrderDetail(shipment.trackingCode);
    } catch (apiErr) {
      const errMsg = String(apiErr?.message || '');
      const isNotFound = errMsg.includes('không tồn tại') || errMsg.includes('tenant_order_detail') || apiErr?.status === 400;

      if (isNotFound) {
        await OrderShipment.updateOne(
          { _id: shipment._id },
          {
            $set: {
              shipmentStatus: 'cancelled',
              lastSyncedAt: new Date(),
            },
            $push: {
              statusHistory: {
                status: 'cancelled',
                description: 'Đơn hàng không tồn tại trên hệ thống GHN',
                timestamp: new Date(),
              },
            },
          }
        );
        shipment.shipmentStatus = 'cancelled';
        shipment.lastSyncedAt = new Date();
        return shipment;
      }

      // Các lỗi tạm thời (mạng, timeout): cập nhật lastSyncedAt để không bị kẹt lặp liên tục
      await OrderShipment.updateOne(
        { _id: shipment._id },
        { $set: { lastSyncedAt: new Date() } }
      );
      return shipment;
    }

    if (!ghnData || !ghnData.status) {
      await OrderShipment.updateOne({ _id: shipment._id }, { $set: { lastSyncedAt: new Date() } });
      return shipment;
    }

    const mapped = mapGhnStatus(ghnData.status);
    let hasChanged = false;

    if (mapped.internalStatus !== shipment.shipmentStatus) {
      shipment.shipmentStatus = mapped.internalStatus;
      hasChanged = true;

      const actionTime = new Date();
      if (mapped.internalStatus === 'delivered') {
        shipment.deliveredAt = shipment.deliveredAt || actionTime;
        if (shipment.orderType === 'sale') {
          await SalesOrder.findOneAndUpdate(
            { _id: shipment.orderId, orderStatus: { $nin: ['cancelled'] } },
            { orderStatus: 'completed' }
          );
        } else if (shipment.orderType === 'rental') {
          if (shipment.shipmentType === 'outbound') {
            const rental = await RentalOrder.findOne({ _id: shipment.orderId });
            // Chỉ kích hoạt chu kỳ thuê một lần khi bưu tá giao thành công thực tế
            if (rental && !rental.actualDeliveryDate && rental.rentalStatus !== 'renting') {
              const durationMs = rental.dueDate && rental.startDate
                ? Math.max(86400000, new Date(rental.dueDate).getTime() - new Date(rental.startDate).getTime())
                : 3 * 86400000;
              rental.rentalStatus = 'renting';
              rental.actualDeliveryDate = actionTime;
              rental.actualPickupDate = actionTime;
              rental.startDate = actionTime;
              rental.dueDate = new Date(actionTime.getTime() + durationMs);
              await rental.save();
            }
          }
        }
      } else if (mapped.internalStatus === 'shipped' && !shipment.shippedAt) {
        shipment.shippedAt = actionTime;
      } else if (mapped.internalStatus === 'cancelled') {
        shipment.cancelledAt = shipment.cancelledAt || actionTime;
        // Đồng bộ hủy vận đơn outbound từ GHN sang đơn hàng của khách.
        if (shipment.shipmentType === 'outbound') {
          if (shipment.orderType === 'rental') {
            await RentalOrder.findOneAndUpdate(
              { _id: shipment.orderId, rentalStatus: { $in: ['confirmed', 'draft'] } },
              { $set: { rentalStatus: 'cancelled' } }
            );
          } else if (shipment.orderType === 'sale') {
            await SalesOrder.findOneAndUpdate(
              { _id: shipment.orderId, orderStatus: { $in: ['confirmed', 'draft', 'processing', 'shipped'] } },
              { $set: { orderStatus: 'cancelled', cancelledAt: actionTime } }
            );
          }
        }
      }
    }

    if (ghnData.total_fee && typeof ghnData.total_fee === 'number') {
      shipment.shippingFee = ghnData.total_fee;
    }
    if (ghnData.leadtime) {
      const expDate = new Date(ghnData.leadtime * 1000);
      if (!isNaN(expDate.getTime())) shipment.expectedDeliveryTime = expDate;
    }

    // Ghi nhận lịch sử nếu trạng thái mới chưa được lưu ở mốc gần nhất
    const lastHistory = shipment.statusHistory && shipment.statusHistory.length > 0
      ? shipment.statusHistory[shipment.statusHistory.length - 1]
      : null;

    if (!lastHistory || lastHistory.status !== mapped.internalStatus || lastHistory.ghnStatus !== ghnData.status) {
      shipment.statusHistory.push({
        status: mapped.internalStatus,
        ghnStatus: ghnData.status,
        description: mapped.description,
        timestamp: new Date(),
      });
      hasChanged = true;
    }

    shipment.lastSyncedAt = new Date();
    try {
      await shipment.save();
    } catch {
      // Fallback an toàn nếu có trường schema cũ không hợp lệ
      await OrderShipment.updateOne(
        { _id: shipment._id },
        {
          $set: {
            shipmentStatus: shipment.shipmentStatus,
            shippingFee: shipment.shippingFee,
            expectedDeliveryTime: shipment.expectedDeliveryTime,
            shippedAt: shipment.shippedAt,
            deliveredAt: shipment.deliveredAt,
            cancelledAt: shipment.cancelledAt,
            lastSyncedAt: shipment.lastSyncedAt,
            statusHistory: shipment.statusHistory,
          },
        }
      );
    }
    return shipment;
  } catch {
    return null;
  }
};

/**
 * Quét đối soát các vận đơn đang trong hành trình (preparing, shipped)
 */
export const syncInFlightShipments = async () => {
  try {
    const thresholdDate = new Date(Date.now() - 2 * 60 * 1000); // 2 phút trước

    const inFlightShipments = await OrderShipment.find({
      shipmentStatus: { $in: ['preparing', 'shipped'] },
      trackingCode: { $exists: true, $ne: '', $not: /^(SHP|TRK)-/ },
      $or: [
        { lastSyncedAt: { $lt: thresholdDate } },
        { lastSyncedAt: null },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(50);

    if (!inFlightShipments.length) {
      return { synced: 0 };
    }

    let updatedCount = 0;
    for (const shipment of inFlightShipments) {
      const updated = await syncSingleShipmentFromGHN(shipment, true);
      if (updated) updatedCount++;
      await delay(300); // Nghỉ 300ms giữa các request để bảo vệ rate limit
    }

    return { synced: updatedCount, totalChecked: inFlightShipments.length };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Khởi động background sync job chạy định kỳ (mặc định mỗi 2 phút)
 */
export const startShipmentSyncJob = (intervalMinutes = 2) => {
  const intervalMs = intervalMinutes * 60 * 1000;

  // Chạy lần đầu sau 15 giây khi server khởi động
  setTimeout(() => {
    syncInFlightShipments().catch(() => {});
  }, 15 * 1000);

  // Thiết lập interval định kỳ
  return setInterval(() => {
    syncInFlightShipments().catch(() => {});
  }, intervalMs);
};
