import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import * as ghnService from './ghnService.js';
import { mapGhnStatus } from './ghnStatusMapper.js';
import { isMockMode } from './ghnConfig.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Quét đối soát các vận đơn đang trong hành trình (preparing, shipped)
 */
export const syncInFlightShipments = async () => {
  if (isMockMode()) {
    return { synced: 0, notice: 'Mock mode active, skip external polling' };
  }

  try {
    const thresholdDate = new Date(Date.now() - 30 * 60 * 1000); // Cách đây 30 phút

    const inFlightShipments = await OrderShipment.find({
      shipmentStatus: { $in: ['preparing', 'shipped'] },
      trackingCode: { $exists: true, $ne: '' },
      $or: [
        { lastSyncedAt: { $lt: thresholdDate } },
        { lastSyncedAt: null },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(50); // Batch tối đa 50 đơn mỗi lần

    if (!inFlightShipments.length) {
      return { synced: 0 };
    }

    console.log(`[Shipment Fallback Polling] Bắt đầu quét đồng bộ ${inFlightShipments.length} vận đơn...`);
    let updatedCount = 0;

    for (const shipment of inFlightShipments) {
      try {
        const ghnData = await ghnService.getGHNOrderDetail(shipment.trackingCode);
        if (ghnData && ghnData.status) {
          const mapped = mapGhnStatus(ghnData.status);

          if (mapped.internalStatus !== shipment.shipmentStatus) {
            console.log(`[Shipment Fallback Polling] Đơn ${shipment.trackingCode} đổi: ${shipment.shipmentStatus} -> ${mapped.internalStatus}`);
            shipment.shipmentStatus = mapped.internalStatus;

            shipment.statusHistory.push({
              status: mapped.internalStatus,
              ghnStatus: ghnData.status,
              description: `[Fallback Polling] ${mapped.description}`,
              timestamp: new Date(),
            });

            if (mapped.internalStatus === 'delivered') {
              shipment.deliveredAt = new Date();
              if (shipment.orderType === 'sale') {
                await SalesOrder.findByIdAndUpdate(shipment.orderId, { orderStatus: 'completed' });
              } else if (shipment.orderType === 'rental' && shipment.shipmentType === 'outbound') {
                await RentalOrder.findByIdAndUpdate(shipment.orderId, { rentalStatus: 'renting', startDate: new Date() });
              }
            } else if (mapped.internalStatus === 'shipped' && !shipment.shippedAt) {
              shipment.shippedAt = new Date();
            }

            updatedCount++;
          }
        }

        shipment.lastSyncedAt = new Date();
        await shipment.save();
        await delay(300); // Nghỉ 300ms giữa các request để bảo vệ rate limit
      } catch (err) {
        console.warn(`[Shipment Fallback Polling] Lỗi sync đơn ${shipment.trackingCode}:`, err.message);
      }
    }

    console.log(`[Shipment Fallback Polling] Hoàn tất đồng bộ: ${updatedCount}/${inFlightShipments.length} đơn có cập nhật mới.`);
    return { synced: updatedCount, totalChecked: inFlightShipments.length };
  } catch (error) {
    console.error('[Shipment Fallback Polling] Lỗi khi chạy cron job:', error.message);
    return { error: error.message };
  }
};

/**
 * Khởi động background sync job chạy định kỳ (mặc định mỗi 30 phút)
 */
export const startShipmentSyncJob = (intervalMinutes = 30) => {
  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`[Shipment Fallback Polling] Đã kích hoạt job kiểm tra định kỳ mỗi ${intervalMinutes} phút.`);

  // Chạy lần đầu sau 1 phút khi server khởi động
  setTimeout(() => {
    syncInFlightShipments();
  }, 60 * 1000);

  // Thiết lập interval định kỳ
  return setInterval(() => {
    syncInFlightShipments();
  }, intervalMs);
};

