import mongoose from 'mongoose';
import { Shop } from '../../models/shop/Shop.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { RentalReturn } from '../../models/sale&rental/RentalReturn.js';
import { RentalDispute } from '../../models/sale&rental/RentalDispute.js';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';
import '../../models/masterdata/Product.js';
import '../../models/system/User.js';
import { getInventoryReport } from '../warehouse/inventoryReportService.js';
import { validationError } from '../../validations/shop/shopValidation.js';

const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace('brandmanager', 'branchmanager');

const extractCustomerName = (customer, shippingAddress) =>
  customer?.FullName || customer?.fullName || shippingAddress?.receiverName || 'Khách hàng';

const extractCustomerPhone = (customer, shippingAddress) => {
  if (Array.isArray(customer?.Information) && customer.Information.length > 0) {
    const firstPhone = customer.Information.find((info) => info?.Phone)?.Phone;
    if (firstPhone) return firstPhone;
  }
  return customer?.phone || shippingAddress?.phone || '';
};

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

/**
 * Tính khoảng thời gian hiện tại và kỳ đối chiếu trước tương đương
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-004
 */
export function resolveReportTimeWindow({ timeRange = 'MONTH', startDate = null, endDate = null, now = new Date() } = {}) {
  const preset = String(timeRange || 'MONTH').trim().toUpperCase();
  const ref = new Date(now);
  let start;
  let end = new Date(ref);
  let prevStart;
  let prevEnd;

  switch (preset) {
    case 'TODAY': {
      start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
      prevStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1, 0, 0, 0, 0);
      prevEnd = new Date(
        prevStart.getFullYear(),
        prevStart.getMonth(),
        prevStart.getDate(),
        ref.getHours(),
        ref.getMinutes(),
        ref.getSeconds(),
        ref.getMilliseconds()
      );
      break;
    }
    case 'WEEK': {
      start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 6, 0, 0, 0, 0);
      prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7, 0, 0, 0, 0);
      prevEnd = new Date(start.getTime() - 1);
      break;
    }
    case 'QUARTER': {
      const qStartMonth = Math.floor(ref.getMonth() / 3) * 3;
      start = new Date(ref.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
      const prevQYear = qStartMonth === 0 ? ref.getFullYear() - 1 : ref.getFullYear();
      const prevQStartMonth = qStartMonth === 0 ? 9 : qStartMonth - 3;
      prevStart = new Date(prevQYear, prevQStartMonth, 1, 0, 0, 0, 0);
      const prevQNaturalEnd = new Date(prevQYear, prevQStartMonth + 3, 0, 23, 59, 59, 999);
      const elapsedMs = Math.max(0, end.getTime() - start.getTime());
      prevEnd = new Date(Math.min(prevQNaturalEnd.getTime(), prevStart.getTime() + elapsedMs));
      break;
    }
    case 'YEAR': {
      start = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
      const prevYear = ref.getFullYear() - 1;
      prevStart = new Date(prevYear, 0, 1, 0, 0, 0, 0);
      const clampedDay = Math.min(ref.getDate(), daysInMonth(prevYear, ref.getMonth()));
      prevEnd = new Date(
        prevYear,
        ref.getMonth(),
        clampedDay,
        ref.getHours(),
        ref.getMinutes(),
        ref.getSeconds(),
        ref.getMilliseconds()
      );
      break;
    }
    case 'CUSTOM': {
      start = startDate ? new Date(startDate) : new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
      end = endDate ? new Date(endDate) : new Date(ref);
      const spanMs = Math.max(1, end.getTime() - start.getTime() + 1);
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - spanMs + 1);
      break;
    }
    case 'MONTH':
    default: {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
      const prevMonthRaw = ref.getMonth() - 1;
      const prevYear = prevMonthRaw < 0 ? ref.getFullYear() - 1 : ref.getFullYear();
      const prevMonth = (prevMonthRaw + 12) % 12;
      prevStart = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0);
      const clampedDay = Math.min(ref.getDate(), daysInMonth(prevYear, prevMonth));
      prevEnd = new Date(
        prevYear,
        prevMonth,
        clampedDay,
        ref.getHours(),
        ref.getMinutes(),
        ref.getSeconds(),
        ref.getMilliseconds()
      );
      break;
    }
  }

  return { preset, start, end, prevStart, prevEnd };
}

/**
 * Dựng chuỗi số liệu doanh thu theo mốc thời gian thực tế cho biểu đồ
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-004
 */
function buildRevenueSeries({ preset, start, end, rentalOrders, salesOrders }) {
  const buckets = [];
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime() + 1) / (24 * 60 * 60 * 1000)));
  const useHourly = preset === 'TODAY' || (preset === 'CUSTOM' && totalDays <= 1);
  const useDaily = preset === 'WEEK' || (preset === 'CUSTOM' && totalDays > 1 && totalDays <= 14);
  const useMonthly = preset === 'QUARTER' || preset === 'YEAR' || (preset === 'CUSTOM' && totalDays > 62);

  if (useHourly) {
    const base = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
    for (let h = 0; h < 24; h += 4) {
      const bStart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 0, 0, 0);
      const bEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h + 3, 59, 59, 999);
      const padH = String(h).padStart(2, '0');
      const padEndH = String(h + 4).padStart(2, '0');
      buckets.push({
        key: `H${h}`,
        label: `${padH}h-${padEndH}h`,
        fullLabel: `Khung ${padH}:00 - ${padEndH}:00`,
        startMs: bStart.getTime(),
        endMs: bEnd.getTime(),
        rentalRevenue: 0,
        salesRevenue: 0,
        totalRevenue: 0,
        rentalCount: 0,
        salesCount: 0,
      });
    }
  } else if (useDaily) {
    for (let i = 0; i < totalDays; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 0, 0, 0, 0);
      const bEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      buckets.push({
        key: `D${i + 1}`,
        label: `${dd}/${mm}`,
        fullLabel: `Ngày ${dd}/${mm}/${d.getFullYear()}`,
        startMs: d.getTime(),
        endMs: bEnd.getTime(),
        rentalRevenue: 0,
        salesRevenue: 0,
        totalRevenue: 0,
        rentalCount: 0,
        salesCount: 0,
      });
    }
  } else if (useMonthly) {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0);
    const limitEndMs =
      preset === 'QUARTER'
        ? new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999).getTime()
        : preset === 'YEAR'
          ? new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999).getTime()
          : end.getTime();
    let idx = 0;
    while (cursor.getTime() <= limitEndMs && idx < 24) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const bStart = new Date(y, m, 1, 0, 0, 0, 0);
      const bEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
      buckets.push({
        key: `M${y}-${m + 1}`,
        label: `T${m + 1}`,
        fullLabel: `Tháng ${String(m + 1).padStart(2, '0')}/${y}`,
        startMs: bStart.getTime(),
        endMs: bEnd.getTime(),
        rentalRevenue: 0,
        salesRevenue: 0,
        totalRevenue: 0,
        rentalCount: 0,
        salesCount: 0,
      });
      cursor = new Date(y, m + 1, 1, 0, 0, 0, 0);
      idx += 1;
    }
  } else {
    // Weekly buckets (MONTH or CUSTOM 15..62 days)
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
    const hardEndMs =
      preset === 'MONTH'
        ? new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
        : end.getTime();
    let idx = 1;
    while (cursor.getTime() <= hardEndMs && idx <= 12) {
      const bStart = new Date(cursor);
      let bEnd;
      if (preset === 'MONTH') {
        const lastDayOfMonth = daysInMonth(start.getFullYear(), start.getMonth());
        const endDay = Math.min(lastDayOfMonth, cursor.getDate() + 6);
        bEnd = new Date(cursor.getFullYear(), cursor.getMonth(), endDay, 23, 59, 59, 999);
        const sDay = String(bStart.getDate()).padStart(2, '0');
        const eDay = String(bEnd.getDate()).padStart(2, '0');
        const mm = String(bStart.getMonth() + 1).padStart(2, '0');
        buckets.push({
          key: `W${idx}`,
          label: `${sDay}-${eDay}`,
          fullLabel: `Ngày ${sDay} - ${eDay}/${mm}`,
          startMs: bStart.getTime(),
          endMs: bEnd.getTime(),
          rentalRevenue: 0,
          salesRevenue: 0,
          totalRevenue: 0,
          rentalCount: 0,
          salesCount: 0,
        });
        if (endDay >= lastDayOfMonth) break;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), endDay + 1, 0, 0, 0, 0);
      } else {
        const rawEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6, 23, 59, 59, 999);
        bEnd = rawEnd.getTime() > hardEndMs ? new Date(hardEndMs) : rawEnd;
        const sStr = `${String(bStart.getDate()).padStart(2, '0')}/${String(bStart.getMonth() + 1).padStart(2, '0')}`;
        const eStr = `${String(bEnd.getDate()).padStart(2, '0')}/${String(bEnd.getMonth() + 1).padStart(2, '0')}`;
        buckets.push({
          key: `W${idx}`,
          label: sStr,
          fullLabel: `${sStr} - ${eStr}`,
          startMs: bStart.getTime(),
          endMs: bEnd.getTime(),
          rentalRevenue: 0,
          salesRevenue: 0,
          totalRevenue: 0,
          rentalCount: 0,
          salesCount: 0,
        });
        cursor = new Date(bEnd.getFullYear(), bEnd.getMonth(), bEnd.getDate() + 1, 0, 0, 0, 0);
      }
      idx += 1;
    }
  }

  for (const order of rentalOrders) {
    const ts = new Date(order.createdAt).getTime();
    const bucket = buckets.find((b) => ts >= b.startMs && ts <= b.endMs);
    if (bucket) {
      const fee = Number(order.rentalFee || 0);
      bucket.rentalRevenue += fee;
      bucket.totalRevenue += fee;
      bucket.rentalCount += 1;
    }
  }

  for (const order of salesOrders) {
    const ts = new Date(order.createdAt).getTime();
    const bucket = buckets.find((b) => ts >= b.startMs && ts <= b.endMs);
    if (bucket) {
      const amount = Number(order.totalAmount || 0);
      bucket.salesRevenue += amount;
      bucket.totalRevenue += amount;
      bucket.salesCount += 1;
    }
  }

  return buckets.map(({ startMs, endMs, ...rest }) => rest);
}

const buildEmptyReport = ({
  hasAssignment,
  hasStoreLocation,
  shop = null,
  locations = [],
  preset,
  start,
  end,
}) => ({
  hasAssignment,
  hasStoreLocation,
  branchInfo: shop
    ? {
        _id: shop._id,
        name: shop.name,
        address: shop.address || '',
        ward: shop.ward || '',
        city: shop.city || '',
        phone: shop.phone || '',
        status: shop.status || 'ACTIVE',
        isHQ: Boolean(shop.isHQ),
      }
    : null,
  storeLocation: locations[0]
    ? {
        _id: locations[0]._id,
        name: locations[0].name,
        code: locations[0].code,
      }
    : null,
  locationsCount: locations.length,
  timeRange: {
    preset,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  },
  kpi: {
    totalRevenue: 0,
    rentalRevenue: 0,
    salesRevenue: 0,
    growthRate: null,
    hasGrowthBaseline: false,
    heldDeposits: 0,
    totalOrdersCount: 0,
    rentalOrdersCount: 0,
    salesOrdersCount: 0,
    activeRentalsCount: 0,
    overdueRentalsCount: 0,
    turnoverRate: 0,
  },
  orderBreakdown: {
    rental: { confirmed: 0, renting: 0, partially_returned: 0, overdue: 0, returned: 0, cancelled: 0 },
    sales: { confirmed: 0, processing: 0, shipped: 0, completed: 0, cancelled: 0 },
  },
  stockBreakdown: {
    totalUnits: 0,
    available: 0,
    rented: 0,
    inspecting: 0,
    maintenance: 0,
    reserved: 0,
  },
  operations: {
    pendingHandoverCount: 0,
    openDisputesCount: 0,
    incomingTransfersToReceiveCount: 0,
    failedShipmentsCount: 0,
  },
  revenueSeries: buildRevenueSeries({ preset, start, end, rentalOrders: [], salesOrders: [] }),
  topProducts: [],
  slowMovingProducts: [],
  upcomingReturns: [],
  operationalIssues: [],
});

/**
 * Xác định chi nhánh được phép xem cho Quản lý chi nhánh (hoặc Admin)
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-001
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-002
 */
async function resolveAuthorizedBranch({ user, branchId }) {
  const role = user ? normalizeRole(user.Role || user.role) : 'admin';

  if (user && role !== 'branchmanager' && role !== 'admin') {
    throw validationError('Chức năng báo cáo hiệu suất chi nhánh chỉ dành riêng cho Quản lý chi nhánh.', 403);
  }

  if (branchId && !mongoose.isValidObjectId(branchId)) {
    throw validationError('Mã chi nhánh không hợp lệ.', 400);
  }

  let shop = null;
  if (role === 'branchmanager' && user?._id) {
    if (branchId) {
      shop = await Shop.findOne({ _id: branchId, isDeleted: { $ne: true } }).lean();
      if (!shop) {
        throw validationError('Không tìm thấy chi nhánh.', 404);
      }
      if (String(shop.managerId || '') !== String(user._id)) {
        throw validationError('Bạn chỉ được phép xem báo cáo của chi nhánh do mình trực tiếp quản lý.', 403);
      }
    } else {
      shop = await Shop.findOne({ managerId: user._id, isDeleted: { $ne: true } })
        .sort({ createdAt: 1, _id: 1 })
        .lean();
    }
  } else {
    if (branchId) {
      shop = await Shop.findOne({ _id: branchId, isDeleted: { $ne: true } }).lean();
      if (!shop) {
        throw validationError('Không tìm thấy chi nhánh.', 404);
      }
    } else {
      shop = await Shop.findOne({ isDeleted: { $ne: true } })
        .sort({ isHQ: -1, createdAt: 1, _id: 1 })
        .lean();
    }
  }

  return shop;
}

/**
 * Lấy dữ liệu báo cáo hiệu suất & vận hành chi nhánh
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-001
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-002
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-003
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-004
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-005
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-006
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-007
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-008
 * @ears .sdd/features/branch-performance-reports/SPEC.md#REQ-BPR-009
 */
export async function getBranchPerformanceReportData({
  user = null,
  branchId = null,
  timeRange = 'MONTH',
  startDate = null,
  endDate = null,
  now = new Date(),
} = {}) {
  const window = resolveReportTimeWindow({ timeRange, startDate, endDate, now });
  const { preset, start, end, prevStart, prevEnd } = window;

  const shop = await resolveAuthorizedBranch({ user, branchId });
  if (!shop) {
    return buildEmptyReport({
      hasAssignment: false,
      hasStoreLocation: false,
      shop: null,
      locations: [],
      preset,
      start,
      end,
    });
  }

  const locations = await InventoryLocation.find({
    shopId: shop._id,
    type: 'store',
    status: 'active',
  })
    .select('_id code name type status')
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!locations || locations.length === 0) {
    return buildEmptyReport({
      hasAssignment: true,
      hasStoreLocation: false,
      shop,
      locations: [],
      preset,
      start,
      end,
    });
  }

  const locationIds = locations.map((loc) => loc._id);
  const dueHorizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // 1. Truy vấn đơn hàng, doanh thu kỳ hiện tại + kỳ trước, tiền cọc và bộ đếm vận hành song song
  const [
    rentalOrdersPeriod,
    salesOrdersPeriod,
    rentalStatusAgg,
    salesStatusAgg,
    prevRentalAgg,
    prevSalesAgg,
    heldDepositsAgg,
    activeRentalsCount,
    overdueRentalsCount,
    branchRentalOrderIdsRaw,
    pendingRentalHandoverCount,
    pendingSalesHandoverCount,
    incomingTransfersToReceiveCount,
    rentingItemsCount,
    upcomingOrders,
    overdueOrders,
    failedShipments,
  ] = await Promise.all([
    RentalOrder.find({
      locationId: { $in: locationIds },
      createdAt: { $gte: start, $lte: end },
      rentalStatus: { $nin: ['draft', 'cancelled'] },
    })
      .select('_id rentalFee createdAt rentalStatus')
      .lean(),
    SalesOrder.find({
      locationId: { $in: locationIds },
      createdAt: { $gte: start, $lte: end },
      orderStatus: { $nin: ['draft', 'cancelled'] },
    })
      .select('_id totalAmount createdAt orderStatus')
      .lean(),
    RentalOrder.aggregate([
      {
        $match: {
          locationId: { $in: locationIds },
          createdAt: { $gte: start, $lte: end },
          rentalStatus: { $ne: 'draft' },
        },
      },
      { $group: { _id: '$rentalStatus', count: { $sum: 1 } } },
    ]),
    SalesOrder.aggregate([
      {
        $match: {
          locationId: { $in: locationIds },
          createdAt: { $gte: start, $lte: end },
          orderStatus: { $ne: 'draft' },
        },
      },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]),
    RentalOrder.aggregate([
      {
        $match: {
          locationId: { $in: locationIds },
          createdAt: { $gte: prevStart, $lte: prevEnd },
          rentalStatus: { $nin: ['draft', 'cancelled'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$rentalFee' } } },
    ]),
    SalesOrder.aggregate([
      {
        $match: {
          locationId: { $in: locationIds },
          createdAt: { $gte: prevStart, $lte: prevEnd },
          orderStatus: { $nin: ['draft', 'cancelled'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    RentalOrder.aggregate([
      {
        $match: {
          locationId: { $in: locationIds },
          depositStatus: 'held',
          rentalStatus: { $nin: ['draft', 'cancelled'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$depositAmount' } } },
    ]),
    RentalOrder.countDocuments({
      locationId: { $in: locationIds },
      rentalStatus: { $in: ['renting', 'partially_returned'] },
    }),
    RentalOrder.countDocuments({
      locationId: { $in: locationIds },
      $or: [
        { rentalStatus: 'overdue' },
        { rentalStatus: { $in: ['renting', 'partially_returned'] }, dueDate: { $lt: now } },
      ],
    }),
    RentalOrder.find({ locationId: { $in: locationIds } }).select('_id').lean(),
    RentalOrder.countDocuments({
      locationId: { $in: locationIds },
      rentalStatus: 'confirmed',
    }),
    SalesOrder.countDocuments({
      locationId: { $in: locationIds },
      orderStatus: { $in: ['confirmed', 'processing'] },
    }),
    StockTransfer.countDocuments({
      toLocationId: { $in: locationIds },
      status: { $in: ['shipped', 'partially_received'] },
    }),
    InventoryItem.countDocuments({
      locationId: { $in: locationIds },
      status: 'renting',
    }),
    RentalOrder.find({
      locationId: { $in: locationIds },
      rentalStatus: { $in: ['renting', 'partially_returned'] },
      dueDate: { $gte: now, $lte: dueHorizon },
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .populate('customerId', 'FullName Email Information')
      .lean(),
    RentalOrder.find({
      locationId: { $in: locationIds },
      $or: [
        { rentalStatus: 'overdue' },
        { rentalStatus: { $in: ['renting', 'partially_returned'] }, dueDate: { $lt: now } },
      ],
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .populate('customerId', 'FullName Email Information')
      .lean(),
    OrderShipment.find({
      shipmentStatus: 'failed',
      $or: [{ fromShopId: shop._id }, { fromLocationId: { $in: locationIds } }],
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const branchRentalOrderIds = branchRentalOrderIdsRaw.map((row) => row._id);
  const validRentalOrderIds = rentalOrdersPeriod.map((row) => row._id);
  const validSalesOrderIds = salesOrdersPeriod.map((row) => row._id);

  // 2. Truy vấn tồn kho qua inventoryReportService + inspecting returns + disputes + product details
  const [
    inventoryReports,
    inspectingReturnsCount,
    openDisputes,
    rentalDetailsAgg,
    salesDetailsAgg,
    upcomingDetails,
  ] = await Promise.all([
    Promise.all(
      locations.map((loc) =>
        getInventoryReport({
          locationId: String(loc._id),
          storageLevel: 'shelf',
          itemLevel: 'variant',
        })
      )
    ),
    branchRentalOrderIds.length > 0
      ? RentalReturn.countDocuments({
          rentalOrderId: { $in: branchRentalOrderIds },
          returnStatus: { $in: ['received', 'inspecting'] },
        })
      : 0,
    branchRentalOrderIds.length > 0
      ? RentalDispute.find({
          rentalOrderId: { $in: branchRentalOrderIds },
          status: { $in: ['pending_review', 'approved'] },
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate('rentalOrderId', 'orderCode locationId')
          .populate('customerId', 'FullName Information')
          .lean()
      : [],
    validRentalOrderIds.length > 0
      ? RentalOrderDetail.aggregate([
          { $match: { rentalOrderId: { $in: validRentalOrderIds } } },
          {
            $group: {
              _id: '$variantId',
              rentalCount: { $sum: '$quantity' },
              revenue: { $sum: '$lineTotal' },
              orderIds: { $addToSet: '$rentalOrderId' },
            },
          },
        ])
      : [],
    validSalesOrderIds.length > 0
      ? SalesOrderDetail.aggregate([
          { $match: { salesOrderId: { $in: validSalesOrderIds } } },
          {
            $group: {
              _id: '$variantId',
              salesCount: { $sum: '$quantity' },
              revenue: { $sum: '$lineTotal' },
              orderIds: { $addToSet: '$salesOrderId' },
            },
          },
        ])
      : [],
    upcomingOrders.length > 0
      ? RentalOrderDetail.find({ rentalOrderId: { $in: upcomingOrders.map((o) => o._id) } })
          .populate({
            path: 'variantId',
            select: 'productId size color',
            populate: { path: 'productId', select: 'name productCode' },
          })
          .lean()
      : [],
  ]);

  // 3. Tính toán KPI Doanh thu & Tăng trưởng thật
  const rentalRevenue = rentalOrdersPeriod.reduce((sum, ord) => sum + Number(ord.rentalFee || 0), 0);
  const salesRevenue = salesOrdersPeriod.reduce((sum, ord) => sum + Number(ord.totalAmount || 0), 0);
  const totalRevenue = rentalRevenue + salesRevenue;

  const prevRevenue = Number(prevRentalAgg[0]?.total || 0) + Number(prevSalesAgg[0]?.total || 0);
  const hasGrowthBaseline = prevRevenue > 0;
  const growthRate = hasGrowthBaseline
    ? Number((((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
    : null;

  const heldDeposits = Number(heldDepositsAgg[0]?.total || 0);
  const rentalOrdersCount = rentalOrdersPeriod.length;
  const salesOrdersCount = salesOrdersPeriod.length;
  const totalOrdersCount = rentalOrdersCount + salesOrdersCount;

  const rentalBreakdown = {
    confirmed: 0,
    renting: 0,
    partially_returned: 0,
    overdue: 0,
    returned: 0,
    cancelled: 0,
  };
  for (const row of rentalStatusAgg) {
    if (row._id && Object.prototype.hasOwnProperty.call(rentalBreakdown, row._id)) {
      rentalBreakdown[row._id] = row.count;
    }
  }

  const salesBreakdown = {
    confirmed: 0,
    processing: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const row of salesStatusAgg) {
    if (row._id && Object.prototype.hasOwnProperty.call(salesBreakdown, row._id)) {
      salesBreakdown[row._id] = row.count;
    }
  }

  // 4. Tổng hợp Tồn kho chi nhánh
  const stockSummary = inventoryReports.reduce(
    (acc, rep) => ({
      available: acc.available + Number(rep?.summary?.totalAvailable || 0),
      reserved: acc.reserved + Number(rep?.summary?.totalReserved || 0),
      maintenance: acc.maintenance + Number(rep?.summary?.totalUnavailable || 0),
    }),
    { available: 0, reserved: 0, maintenance: 0 }
  );
  const rentedStock = Number(rentingItemsCount || 0);
  const totalStockUnits =
    stockSummary.available + rentedStock + stockSummary.maintenance + stockSummary.reserved;

  // 5. Hiệu suất Sản phẩm (Top 5 doanh thu + Slow-moving + Turnover Rate)
  const variantIds = [
    ...new Set([
      ...rentalDetailsAgg.map((r) => String(r._id)),
      ...salesDetailsAgg.map((s) => String(s._id)),
    ]),
  ];

  const variants = variantIds.length
    ? await ProductVariant.find({ _id: { $in: variantIds } })
        .select('_id productId')
        .populate({
          path: 'productId',
          select: 'name productCode category categoryId',
          populate: { path: 'categoryId', select: 'name' },
        })
        .lean()
    : [];

  const variantToProduct = new Map(variants.map((v) => [String(v._id), v.productId]));
  const productPerfMap = new Map();
  let totalRentalUnits = 0;

  const ensureProductBucket = (prod) => {
    const pid = String(prod._id);
    if (!productPerfMap.has(pid)) {
      const categoryLabel =
        Array.isArray(prod.categoryId) && prod.categoryId.length > 0
          ? prod.categoryId.map((c) => c?.name).filter(Boolean).join(', ')
          : Array.isArray(prod.category) && prod.category.length > 0
            ? prod.category.join(', ')
            : 'Atelier';
      productPerfMap.set(pid, {
        productId: prod._id,
        name: prod.name || 'Trang phục Haute Couture',
        category: categoryLabel,
        rentalCount: 0,
        salesCount: 0,
        orderIds: new Set(),
        revenue: 0,
        imageUrl: '',
      });
    }
    return productPerfMap.get(pid);
  };

  for (const row of rentalDetailsAgg) {
    const prod = variantToProduct.get(String(row._id));
    if (!prod?._id) continue;
    const bucket = ensureProductBucket(prod);
    const units = Number(row.rentalCount || 0);
    totalRentalUnits += units;
    bucket.rentalCount += units;
    bucket.revenue += Number(row.revenue || 0);
    (row.orderIds || []).forEach((oid) => bucket.orderIds.add(`r_${oid}`));
  }

  for (const row of salesDetailsAgg) {
    const prod = variantToProduct.get(String(row._id));
    if (!prod?._id) continue;
    const bucket = ensureProductBucket(prod);
    bucket.salesCount += Number(row.salesCount || 0);
    bucket.revenue += Number(row.revenue || 0);
    (row.orderIds || []).forEach((oid) => bucket.orderIds.add(`s_${oid}`));
  }

  const rankedProducts = [...productPerfMap.values()]
    .sort((a, b) => b.revenue - a.revenue || b.rentalCount + b.salesCount - (a.rentalCount + a.salesCount))
    .slice(0, 5);

  if (rankedProducts.length > 0) {
    const images = await ProductImage.find({
      productId: { $in: rankedProducts.map((p) => p.productId) },
    })
      .sort({ isPrimary: -1, displayOrder: 1 })
      .lean();
    const imageMap = new Map();
    for (const img of images) {
      const pid = String(img.productId);
      if (!imageMap.has(pid)) imageMap.set(pid, img.imageUrl);
    }
    rankedProducts.forEach((p) => {
      p.imageUrl = imageMap.get(String(p.productId)) || '';
    });
  }

  const topProducts = rankedProducts.map(({ orderIds, ...rest }) => ({
    ...rest,
    orderCount: orderIds.size,
  }));

  const turnoverDenominator = stockSummary.available + rentedStock;
  const turnoverRate =
    turnoverDenominator > 0 ? Number((totalRentalUnits / turnoverDenominator).toFixed(2)) : 0;

  // Slow-moving products: có tồn kho sẵn sàng tại cửa hàng nhưng không phát sinh đơn trong kỳ
  const slowMovingMap = new Map();
  for (const rep of inventoryReports) {
    for (const item of rep?.items || []) {
      const pid = item.productId ? String(item.productId) : '';
      if (!pid || productPerfMap.has(pid) || Number(item.quantityAvailable || 0) <= 0) continue;
      if (!slowMovingMap.has(pid)) {
        slowMovingMap.set(pid, {
          productId: item.productId,
          name: item.productName || 'Sản phẩm',
          category: item.categoryName || 'Atelier',
          availableQty: 0,
        });
      }
      slowMovingMap.get(pid).availableQty += Number(item.quantityAvailable || 0);
    }
  }
  const slowMovingProducts = [...slowMovingMap.values()]
    .sort((a, b) => b.availableQty - a.availableQty)
    .slice(0, 5);

  // 6. Lịch Đơn Sắp Hoàn Trả (trong 48h tới)
  const detailsByOrderId = new Map();
  for (const det of upcomingDetails) {
    const oid = String(det.rentalOrderId);
    if (!detailsByOrderId.has(oid)) detailsByOrderId.set(oid, []);
    detailsByOrderId.get(oid).push(det);
  }

  const upcomingReturns = upcomingOrders.map((ord) => {
    const orderDetails = detailsByOrderId.get(String(ord._id)) || [];
    const primaryName = orderDetails[0]?.variantId?.productId?.name || 'Trang phục thuê';
    const productName =
      orderDetails.length > 1 ? `${primaryName} (+${orderDetails.length - 1} món)` : primaryName;
    const dueObj = new Date(ord.dueDate);
    const isDueToday =
      dueObj.getFullYear() === now.getFullYear() &&
      dueObj.getMonth() === now.getMonth() &&
      dueObj.getDate() === now.getDate();
    const hoursRemaining = Math.max(0, Math.round((dueObj.getTime() - now.getTime()) / (60 * 60 * 1000)));

    return {
      _id: ord._id,
      orderCode: ord.orderCode || `THUE-${String(ord._id).slice(-4).toUpperCase()}`,
      customerName: extractCustomerName(ord.customerId, ord.shippingAddress),
      customerPhone: extractCustomerPhone(ord.customerId, ord.shippingAddress),
      productName,
      dueDate: ord.dueDate,
      hoursRemaining,
      isDueToday,
      depositAmount: Number(ord.depositAmount || 0),
      rentalStatus: ord.rentalStatus,
    };
  });

  // 7. Sự cố vận hành
  const reasonLabelMap = {
    damaged_in_transit: 'Hư hỏng khi vận chuyển',
    manufacturing_defect: 'Lỗi kỹ thuật trang phục',
    wrong_item_or_color: 'Giao sai mẫu/màu sắc',
    missing_accessories: 'Thiếu phụ kiện đi kèm',
    other: 'Khiếu nại / Sự cố đơn thuê',
  };

  const overdueIssues = overdueOrders.map((ord) => {
    const diffMs = Math.max(0, now.getTime() - new Date(ord.dueDate).getTime());
    const overdueDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    return {
      id: `issue_od_${ord._id}`,
      type: 'OVERDUE',
      orderCode: ord.orderCode || `THUE-${String(ord._id).slice(-4).toUpperCase()}`,
      customerName: extractCustomerName(ord.customerId, ord.shippingAddress),
      customerPhone: extractCustomerPhone(ord.customerId, ord.shippingAddress),
      overdueDays,
      detail: `Trễ hạn trả ${overdueDays} ngày — cần liên hệ đôn đốc hoàn trả`,
      severity: overdueDays >= 3 ? 'HIGH' : 'MEDIUM',
      actionPath: '/branch/rental-orders',
    };
  });

  const disputeIssues = openDisputes.map((d) => ({
    id: `issue_dp_${d._id}`,
    type: 'DAMAGE_DISPUTE',
    orderCode: d.rentalOrderId?.orderCode || d.disputeCode || `DISP-${String(d._id).slice(-4).toUpperCase()}`,
    customerName: extractCustomerName(d.customerId, null),
    customerPhone: extractCustomerPhone(d.customerId, null),
    detail: `${reasonLabelMap[d.reason] || 'Khiếu nại đơn thuê'}: ${d.description}`,
    severity: 'HIGH',
    actionPath: '/branch/returns',
  }));

  const shipmentIssues = failedShipments.map((s) => ({
    id: `issue_ship_${s._id}`,
    type: 'FAILED_SHIPMENT',
    orderCode: s.orderCode || s.shipmentCode || s.trackingCode || `SHIP-${String(s._id).slice(-4).toUpperCase()}`,
    customerName: s.receiverInfo?.name || 'Khách nhận hàng',
    customerPhone: s.receiverInfo?.phone || '',
    detail: `Giao vận thất bại (${s.carrierName || 'Đơn vị vận chuyển'})${s.note ? `: ${s.note}` : ''}`,
    severity: 'MEDIUM',
    actionPath: s.orderType === 'sale' ? '/branch/sale-orders' : '/branch/rental-orders',
  }));

  const operationalIssues = [...overdueIssues, ...disputeIssues, ...shipmentIssues];

  return {
    hasAssignment: true,
    hasStoreLocation: true,
    branchInfo: {
      _id: shop._id,
      name: shop.name,
      address: shop.address || '',
      ward: shop.ward || '',
      city: shop.city || '',
      phone: shop.phone || '',
      status: shop.status || 'ACTIVE',
      isHQ: Boolean(shop.isHQ),
    },
    storeLocation: {
      _id: locations[0]._id,
      name: locations[0].name,
      code: locations[0].code,
    },
    locationsCount: locations.length,
    timeRange: {
      preset,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
    kpi: {
      totalRevenue,
      rentalRevenue,
      salesRevenue,
      growthRate,
      hasGrowthBaseline,
      heldDeposits,
      totalOrdersCount,
      rentalOrdersCount,
      salesOrdersCount,
      activeRentalsCount,
      overdueRentalsCount,
      turnoverRate,
    },
    orderBreakdown: {
      rental: rentalBreakdown,
      sales: salesBreakdown,
    },
    stockBreakdown: {
      totalUnits: totalStockUnits,
      available: stockSummary.available,
      rented: rentedStock,
      inspecting: Number(inspectingReturnsCount || 0),
      maintenance: stockSummary.maintenance,
      reserved: stockSummary.reserved,
    },
    operations: {
      pendingHandoverCount: Number(pendingRentalHandoverCount || 0) + Number(pendingSalesHandoverCount || 0),
      openDisputesCount: openDisputes.length,
      incomingTransfersToReceiveCount: Number(incomingTransfersToReceiveCount || 0),
      failedShipmentsCount: failedShipments.length,
    },
    revenueSeries: buildRevenueSeries({
      preset,
      start,
      end,
      rentalOrders: rentalOrdersPeriod,
      salesOrders: salesOrdersPeriod,
    }),
    topProducts,
    slowMovingProducts,
    upcomingReturns,
    operationalIssues,
  };
}
