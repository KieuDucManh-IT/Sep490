import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import * as ghnService from './ghnService.js';
import { mapGhnStatus } from './ghnStatusMapper.js';
import { recordSalesDelivery } from '../sale&rental/salesOrderService.js';
import {
  ensureRentalInventory,
} from '../sale&rental/rentalOrderService.js';

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Đồng bộ một vận đơn trực tiếp từ GHN vào MongoDB.
 * @param {string|Object} trackingCodeOrShipment
 * @param {boolean} force
 */
export const syncSingleShipmentFromGHN = async (
  trackingCodeOrShipment,
  force = false
) => {
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
    } else if (
      trackingCodeOrShipment &&
      trackingCodeOrShipment._id
    ) {
      shipment = await OrderShipment.findById(
        trackingCodeOrShipment._id
      );
    }

    if (!shipment || !shipment.trackingCode) {
      return shipment;
    }

    if (shipment.isSimulated) {
      return shipment;
    }

    // Tránh gửi request liên tục nếu vừa đồng bộ trong 3 giây.
    if (
      !force &&
      shipment.lastSyncedAt &&
      Date.now() -
        new Date(shipment.lastSyncedAt).getTime() <
        3000
    ) {
      return shipment;
    }

    // Không gọi GHN đối với mã nội bộ hoặc mã thử nghiệm.
    if (
      shipment.trackingCode.startsWith('TRK-') ||
      shipment.trackingCode.startsWith('SHP-')
    ) {
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
      ghnData = await ghnService.getGHNOrderDetail(
        shipment.trackingCode
      );
    } catch (apiErr) {
      const errMsg = String(apiErr?.message || '');

      const isNotFound =
        errMsg.includes('không tồn tại') ||
        errMsg.includes('tenant_order_detail') ||
        apiErr?.status === 400;

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
                description:
                  'Đơn hàng không tồn tại trên hệ thống GHN',
                timestamp: new Date(),
              },
            },
          }
        );

        shipment.shipmentStatus = 'cancelled';
        shipment.lastSyncedAt = new Date();

        return shipment;
      }

      // Lỗi tạm thời: cập nhật thời điểm đồng bộ để tránh gọi dồn.
      await OrderShipment.updateOne(
        { _id: shipment._id },
        {
          $set: {
            lastSyncedAt: new Date(),
          },
        }
      );

      return shipment;
    }

    if (!ghnData || !ghnData.status) {
      await OrderShipment.updateOne(
        { _id: shipment._id },
        {
          $set: {
            lastSyncedAt: new Date(),
          },
        }
      );

      return shipment;
    }

    const mapped = mapGhnStatus(ghnData.status);
    let hasChanged = false;

    // Không để dữ liệu GHN kéo lùi trạng thái đang có trong DB.
    const STATUS_RANK = {
      preparing: 1,
      shipped: 2,
      failed: 2,
      delivered: 3,
      cancelled: 3,
    };

    const currentRank =
      STATUS_RANK[shipment.shipmentStatus] ?? 0;

    const incomingRank =
      STATUS_RANK[mapped.internalStatus] ?? 0;

    if (incomingRank < currentRank) {
      await OrderShipment.updateOne(
        { _id: shipment._id },
        {
          $set: {
            lastSyncedAt: new Date(),
          },
        }
      );

      return shipment;
    }

    // Nếu vừa có cập nhật trong 10 phút và GHN không có
    // trạng thái cao hơn thì không ghi đè bằng polling.
    const recentHistory =
      shipment.statusHistory?.[
        shipment.statusHistory.length - 1
      ];

    if (
      recentHistory &&
      incomingRank <= currentRank &&
      Date.now() -
        new Date(recentHistory.timestamp || 0).getTime() <
        600000
    ) {
      await OrderShipment.updateOne(
        { _id: shipment._id },
        {
          $set: {
            lastSyncedAt: new Date(),
          },
        }
      );

      return shipment;
    }

    if (
      mapped.internalStatus !== shipment.shipmentStatus
    ) {
      shipment.shipmentStatus = mapped.internalStatus;
      hasChanged = true;

      const actionTime = new Date();

      if (mapped.internalStatus === 'delivered') {
        shipment.deliveredAt =
          shipment.deliveredAt || actionTime;

        if (shipment.orderType === 'sale') {
          await recordSalesDelivery(
            shipment,
            actionTime
          );
        } else if (shipment.orderType === 'rental') {
          if (shipment.shipmentType === 'outbound') {
            await ensureRentalInventory(
              shipment.orderId,
              {
                dispatch: true,
                deliveredAt: actionTime,
              }
            );
          }
        }
      } else if (
        mapped.internalStatus === 'shipped' &&
        !shipment.shippedAt
      ) {
        shipment.shippedAt = actionTime;
      } else if (
        mapped.internalStatus === 'cancelled'
      ) {
        shipment.cancelledAt =
          shipment.cancelledAt || actionTime;

        // Đồng bộ hủy vận đơn giao đi sang đơn hàng.
        if (shipment.shipmentType === 'outbound') {
          if (shipment.orderType === 'rental') {
            await RentalOrder.findOneAndUpdate(
              {
                _id: shipment.orderId,
                rentalStatus: {
                  $in: ['confirmed', 'draft'],
                },
              },
              {
                $set: {
                  rentalStatus: 'cancelled',
                },
              }
            );
          } else if (shipment.orderType === 'sale') {
            await SalesOrder.findOneAndUpdate(
              {
                _id: shipment.orderId,
                orderStatus: {
                  $in: [
                    'confirmed',
                    'draft',
                    'processing',
                    'shipped',
                  ],
                },
              },
              {
                $set: {
                  orderStatus: 'cancelled',
                  cancelledAt: actionTime,
                },
              }
            );
          }
        }
      }
    }

    if (
      ghnData.total_fee &&
      typeof ghnData.total_fee === 'number'
    ) {
      shipment.shippingFee = ghnData.total_fee;
    }

    if (ghnData.leadtime) {
      const expDate = new Date(
        ghnData.leadtime * 1000
      );

      if (!isNaN(expDate.getTime())) {
        shipment.expectedDeliveryTime = expDate;
      }
    }

    // Ghi lịch sử nếu trạng thái mới chưa được lưu gần nhất.
    const lastHistory =
      shipment.statusHistory &&
      shipment.statusHistory.length > 0
        ? shipment.statusHistory[
            shipment.statusHistory.length - 1
          ]
        : null;

    if (
      !lastHistory ||
      lastHistory.status !== mapped.internalStatus ||
      lastHistory.ghnStatus !== ghnData.status
    ) {
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
      // Fallback nếu dữ liệu cũ không đáp ứng validation của schema.
      await OrderShipment.updateOne(
        { _id: shipment._id },
        {
          $set: {
            shipmentStatus: shipment.shipmentStatus,
            shippingFee: shipment.shippingFee,
            expectedDeliveryTime:
              shipment.expectedDeliveryTime,
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
 * Quét đối soát các vận đơn đang trong hành trình.
 */
export const syncInFlightShipments = async () => {
  try {
    const thresholdDate = new Date(
      Date.now() - 2 * 60 * 1000
    );

    const inFlightShipments = await OrderShipment.find({
      shipmentStatus: {
        $in: ['preparing', 'shipped'],
      },
      isSimulated: {
        $ne: true,
      },
      trackingCode: {
        $exists: true,
        $ne: '',
        $not: /^(SHP|TRK)-/,
      },
      $or: [
        {
          lastSyncedAt: {
            $lt: thresholdDate,
          },
        },
        {
          lastSyncedAt: null,
        },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(50);

    if (!inFlightShipments.length) {
      return { synced: 0 };
    }

    let updatedCount = 0;

    for (const shipment of inFlightShipments) {
      const updated = await syncSingleShipmentFromGHN(
        shipment,
        true
      );

      if (updated) {
        updatedCount++;
      }

      // Nghỉ giữa các request để hạn chế rate limit.
      await delay(300);
    }

    return {
      synced: updatedCount,
      totalChecked: inFlightShipments.length,
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
};

/**
 * Khởi động đồng bộ định kỳ, mặc định mỗi 2 phút.
 */
export const startShipmentSyncJob = (
  intervalMinutes = 2
) => {
  const intervalMs =
    intervalMinutes * 60 * 1000;

  // Chạy lần đầu sau 15 giây khi server khởi động.
  setTimeout(() => {
    syncInFlightShipments().catch(() => {});
  }, 15 * 1000);

  return setInterval(() => {
    syncInFlightShipments().catch(() => {});
  }, intervalMs);
};