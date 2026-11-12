import mongoose from 'mongoose';
import { Shop } from '../../models/shop/Shop.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { RentalDispute } from '../../models/sale&rental/RentalDispute.js';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { resolveAssignedBranchForUser } from './shopBranchService.js';
import { getInventoryReport } from '../warehouse/inventoryReportService.js';
import { validateObjectId } from '../../validations/shop/shopValidation.js';

export const EXCLUDED_REVENUE_STATUSES = new Set(['cancelled', 'draft']);
export const ACTIVE_RENTAL_STATUSES = new Set(['renting', 'partially_returned', 'overdue']);
const VALID_TIME_RANGES = new Set(['TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR']);
const OPEN_DISPUTE_STATUSES = ['pending_review', 'approved'];

/**
 * Filter truy vấn kho cửa hàng (type: 'store') của đúng 1 chi nhánh — loại trừ kho tổng ('warehouse') và chi nhánh khác.
 */
export const buildStoreLocationFilter = (shopId) => ({
  shopId,
  type: 'store',
  status: 'active',
});

const pad2 = (n) => String(n).padStart(2, '0');
const cleanUserRole = (user) =>
  String(user?.Role || user?.role || '').trim().toLowerCase().replace(/[\s_-]/g, '');
const createHttpError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
const toObjectIds = (ids = []) =>
  ids.map((id) => (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id)).filter(Boolean);

/**
 * Kiểm tra quyền xem báo cáo chi nhánh (chặn truy cập chéo chi nhánh).
 */
export function assertUserCanViewBranchReport(user, shop) {
  if (!shop) throw createHttpError('Không tìm thấy chi nhánh.', 404);
  const role = cleanUserRole(user);
  if (role === 'admin') return;

  const userIdStr = String(user?._id || '');
  const isManager = Boolean(shop.managerId && shop.managerId.toString() === userIdStr);
  const isOwner = Boolean(shop.ownerId && shop.ownerId.toString() === userIdStr);

  if (['branchmanager', 'brandmanager'].includes(role)) {
    if (!isManager) throw createHttpError('Bạn không có quyền xem báo cáo của chi nhánh này.', 403);
    return;
  }
  if (['shopowner', 'owner'].includes(role)) {
    if (!isOwner && !isManager) throw createHttpError('Bạn không có quyền xem báo cáo của chi nhánh này.', 403);
    return;
  }
  throw createHttpError('Vai trò tài khoản không được phép xem báo cáo chi nhánh.', 403);
}

/**
 * Chuẩn hóa tên và SĐT khách hàng từ User doc.
 */
export function extractCustomerInfo(customerDoc) {
  if (!customerDoc || typeof customerDoc !== 'object') {
    return { fullName: 'Khách vãng lai', phone: '' };
  }
  const infoObj = Array.isArray(customerDoc.Information) ? customerDoc.Information[0] : customerDoc.Information;
  return {
    fullName: customerDoc.FullName || customerDoc.fullName || 'Khách vãng lai',
    phone: infoObj?.Phone || infoObj?.phone || customerDoc.phone || '',
  };
}

/**
 * Chuẩn hóa bộ lọc thời gian về 5 mốc preset hợp lệ.
 */
export function normalizeTimeRange(timeRange) {
  const upper = String(timeRange || 'MONTH').trim().toUpperCase();
  return VALID_TIME_RANGES.has(upper) ? upper : 'MONTH';
}

/**
 * Tính khoảng thời gian hiện tại theo preset TODAY | WEEK | MONTH | QUARTER | YEAR.
 */
export function computeDateRange({ timeRange = 'MONTH', now = new Date() } = {}) {
  const ref = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  const resolved = normalizeTimeRange(timeRange);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();

  const starts = {
    TODAY: () => new Date(y, m, d, 0, 0, 0, 0),
    WEEK: () => new Date(y, m, d - ((ref.getDay() + 6) % 7), 0, 0, 0, 0),
    MONTH: () => new Date(y, m, 1, 0, 0, 0, 0),
    QUARTER: () => new Date(y, Math.floor(m / 3) * 3, 1, 0, 0, 0, 0),
    YEAR: () => new Date(y, 0, 1, 0, 0, 0, 0),
  };

  return { timeRange: resolved, start: starts[resolved](), end: ref };
}

/**
 * Tính khoảng thời gian kỳ trước tương đương (có clamp cuối kỳ trước để tránh lệch ngày 29/30/31).
 */
export function computePreviousPeriod(timeRange, start, end) {
  const elapsedMs = Math.max(0, end.getTime() - start.getTime());
  const y = start.getFullYear();
  const m = start.getMonth();
  const d = start.getDate();

  const specs = {
    TODAY: [new Date(y, m, d - 1, 0, 0, 0, 0), new Date(y, m, d - 1, 23, 59, 59, 999)],
    WEEK: [new Date(y, m, d - 7, 0, 0, 0, 0), new Date(y, m, d - 1, 23, 59, 59, 999)],
    MONTH: [new Date(y, m - 1, 1, 0, 0, 0, 0), new Date(y, m, 0, 23, 59, 59, 999)],
    QUARTER: [new Date(y, m - 3, 1, 0, 0, 0, 0), new Date(y, m, 0, 23, 59, 59, 999)],
    YEAR: [new Date(y - 1, 0, 1, 0, 0, 0, 0), new Date(y - 1, 11, 31, 23, 59, 59, 999)],
  };

  const [prevStart, prevMaxEnd] = specs[timeRange] || specs.MONTH;
  return {
    prevStart,
    prevEnd: new Date(Math.min(prevMaxEnd.getTime(), prevStart.getTime() + elapsedMs)),
  };
}

/**
 * Tính % tăng trưởng so với kỳ trước (null khi chưa có baseline kỳ trước).
 */
export function computeGrowthRate(currentRevenue, previousRevenue) {
  const current = Number(currentRevenue || 0);
  const previous = Number(previousRevenue || 0);
  if (previous <= 0) return { growthRate: null, hasBaseline: false };
  return {
    growthRate: Math.round(((current - previous) / previous) * 1000) / 10,
    hasBaseline: true,
  };
}

const makeBucket = (key, label, fullLabel) => ({
  key,
  label,
  fullLabel,
  rentalRevenue: 0,
  salesRevenue: 0,
  totalRevenue: 0,
  rentalCount: 0,
  salesCount: 0,
});

function getBucketSpec(timeRange, start) {
  const y = start.getFullYear();
  const m = start.getMonth();

  if (timeRange === 'TODAY') {
    const slots = [0, 3, 6, 9, 12, 15, 18, 21];
    return {
      buckets: slots.map((h) => makeBucket(`H${pad2(h)}`, `${pad2(h)}h`, `${pad2(h)}:00 - ${pad2((h + 3) % 24)}:00`)),
      resolveKey: (dt) => `H${pad2(Math.floor(dt.getHours() / 3) * 3)}`,
    };
  }
  if (timeRange === 'WEEK') {
    const dayKey = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    return {
      buckets: labels.map((lbl, idx) => {
        const dt = new Date(y, m, start.getDate() + idx);
        return makeBucket(dayKey(dt), lbl, `${lbl} (${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)})`);
      }),
      resolveKey: dayKey,
    };
  }
  if (timeRange === 'QUARTER') {
    const monthKey = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
    return {
      buckets: [0, 1, 2].map((offset) => {
        const dt = new Date(y, m + offset, 1);
        return makeBucket(monthKey(dt), `Tháng ${dt.getMonth() + 1}`, `Tháng ${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`);
      }),
      resolveKey: monthKey,
    };
  }
  if (timeRange === 'YEAR') {
    const monthKey = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
    return {
      buckets: Array.from({ length: 12 }, (_, idx) =>
        makeBucket(`${y}-${pad2(idx + 1)}`, `T${idx + 1}`, `Tháng ${pad2(idx + 1)}/${y}`)
      ),
      resolveKey: monthKey,
    };
  }

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const weeks = [[1, 7], [8, 14], [15, 21], [22, 28], ...(daysInMonth > 28 ? [[29, daysInMonth]] : [])];
  return {
    buckets: weeks.map(([from, to], i) => makeBucket(`W${i + 1}`, `${pad2(from)}-${pad2(to)}`, `Ngày ${pad2(from)} - ${pad2(to)}/${pad2(m + 1)}`)),
    resolveKey: (dt) => `W${Math.min(5, Math.ceil(dt.getDate() / 7))}`,
  };
}

/**
 * Tổng hợp chuỗi doanh thu bán & thuê theo mốc thời gian (loại trừ đơn draft/cancelled).
 */
export function buildRevenueSeries({ timeRange, start, rentalOrders = [], salesOrders = [] }) {
  const { buckets, resolveKey } = getBucketSpec(timeRange, start);
  const bucketMap = new Map(buckets.map((b) => [b.key, b]));

  const addOrders = (orders, statusKey, amountKey, revField, countField) => {
    for (const o of orders) {
      if (EXCLUDED_REVENUE_STATUSES.has(o[statusKey])) continue;
      const bucket = bucketMap.get(resolveKey(new Date(o.createdAt)));
      if (!bucket) continue;
      const amt = Number(o[amountKey] || 0);
      bucket[revField] += amt;
      bucket.totalRevenue += amt;
      bucket[countField] += 1;
    }
  };

  addOrders(rentalOrders, 'rentalStatus', 'rentalFee', 'rentalRevenue', 'rentalCount');
  addOrders(salesOrders, 'orderStatus', 'totalAmount', 'salesRevenue', 'salesCount');
  return buckets;
}

/**
 * Tổng hợp KPI doanh thu & số đơn hợp lệ trong kỳ.
 */
export function summarizePeriodOrders({ rentalOrders = [], salesOrders = [] }) {
  const validRentals = rentalOrders.filter((o) => !EXCLUDED_REVENUE_STATUSES.has(o.rentalStatus));
  const validSales = salesOrders.filter((o) => !EXCLUDED_REVENUE_STATUSES.has(o.orderStatus));
  const rentalRevenue = validRentals.reduce((sum, o) => sum + Number(o.rentalFee || 0), 0);
  const salesRevenue = validSales.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  return {
    totalRevenue: rentalRevenue + salesRevenue,
    rentalRevenue,
    salesRevenue,
    rentalOrdersCount: validRentals.length,
    salesOrdersCount: validSales.length,
    validRentals,
    validSales,
  };
}

/**
 * Chọn tối đa 1 cảnh báo ưu tiên cao nhất cho ribbon trên đầu trang.
 */
export function buildTopNotice({
  hasStoreLocation,
  overdueRentalsCount = 0,
  openDisputesCount = 0,
  pendingHandoverCount = 0,
}) {
  if (!hasStoreLocation) {
    return { severity: 'danger', title: 'Chi nhánh chưa liên kết kho cửa hàng', actionLabel: 'Kiểm tra kho hàng', actionPath: '/branch/inventory' };
  }
  if (overdueRentalsCount > 0) {
    return { severity: 'danger', title: `${overdueRentalsCount} đơn thuê đang quá hạn trả`, actionLabel: 'Xử lý đơn thuê', actionPath: '/branch/rental-orders' };
  }
  if (openDisputesCount > 0) {
    return { severity: 'warning', title: `${openDisputesCount} khiếu nại đơn thuê đang chờ xử lý`, actionLabel: 'Xem đơn thuê', actionPath: '/branch/rental-orders' };
  }
  if (pendingHandoverCount > 0) {
    return { severity: 'warning', title: `${pendingHandoverCount} đơn đã xác nhận đang chờ bàn giao`, actionLabel: 'Bàn giao đơn', actionPath: '/branch/rental-orders' };
  }
  return null;
}

const formatBranchSummary = (branch) =>
  branch
    ? {
        _id: branch._id,
        name: branch.name,
        address: branch.address || '',
        city: branch.city || '',
        ward: branch.ward || '',
        phone: branch.phone || '',
        openingHours: branch.openingHours || '',
        status: branch.status,
        isHQ: Boolean(branch.isHQ),
      }
    : null;

export function buildEmptyBranchReport({ hasAssignment = false, branch = null, locations = [], range }) {
  const firstStore = locations[0] || null;
  return {
    hasAssignment,
    branch: formatBranchSummary(branch),
    storeLocation: firstStore ? { _id: firstStore._id, name: firstStore.name, code: firstStore.code || '' } : null,
    locationsCount: locations.length,
    notice: branch ? buildTopNotice({ hasStoreLocation: locations.length > 0 }) : null,
    kpis: {
      totalRevenue: 0,
      rentalRevenue: 0,
      salesRevenue: 0,
      growthRate: null,
      hasGrowthBaseline: false,
      rentalOrdersCount: 0,
      salesOrdersCount: 0,
      activeRentalsCount: 0,
      overdueRentalsCount: 0,
      heldDeposits: 0,
    },
    operations: {
      pendingHandoverCount: 0,
      openDisputesCount: 0,
      incomingTransfersToReceiveCount: 0,
      failedShipmentsCount: 0,
    },
    stockBreakdown: { totalItems: 0, availableCount: 0, reservedCount: 0, unavailableCount: 0, rentingCount: 0 },
    revenueSeries: buildRevenueSeries({ timeRange: range.timeRange, start: range.start }),
    topProducts: [],
    recentOrders: [],
    upcomingReturns: [],
  };
}

async function resolveAuthorizedBranch(user, requestedBranchId = '') {
  if (requestedBranchId) {
    validateObjectId(requestedBranchId, 'chi nhánh');
    const shop = await Shop.findOne({ _id: requestedBranchId, isDeleted: { $ne: true } }).lean();
    assertUserCanViewBranchReport(user, shop);
    return shop;
  }
  const assigned = await resolveAssignedBranchForUser({
    userId: user?._id,
    userRole: user?.Role || user?.role,
    branchId: '',
  });
  return assigned?.hasAssignment ? assigned.shop : null;
}

async function aggregateBranchStock(locationIds) {
  const [reports, rentingCount] = await Promise.all([
    Promise.all(locationIds.map((id) => getInventoryReport({ locationId: id.toString(), storageLevel: 'shelf', itemLevel: 'variant' }))),
    InventoryItem.countDocuments({ locationId: { $in: locationIds }, status: 'renting' }),
  ]);

  const totals = reports.reduce(
    (acc, r) => ({
      totalItems: acc.totalItems + (r?.summary?.totalOnHand || 0),
      availableCount: acc.availableCount + (r?.summary?.totalAvailable || 0),
      reservedCount: acc.reservedCount + (r?.summary?.totalReserved || 0),
      unavailableCount: acc.unavailableCount + (r?.summary?.totalUnavailable || 0),
    }),
    { totalItems: 0, availableCount: 0, reservedCount: 0, unavailableCount: 0 }
  );

  return { ...totals, rentingCount };
}

async function aggregateTopProductsForBranch({ rentalOrderIds = [], salesOrderIds = [], limit = 5 }) {
  const rIds = toObjectIds(rentalOrderIds);
  const sIds = toObjectIds(salesOrderIds);
  if (!rIds.length && !sIds.length) return [];

  const [rentalDetails, salesDetails] = await Promise.all([
    rIds.length
      ? RentalOrderDetail.aggregate([
          { $match: { rentalOrderId: { $in: rIds } } },
          { $group: { _id: '$variantId', qty: { $sum: '$quantity' }, revenue: { $sum: '$lineTotal' }, orderIds: { $addToSet: '$rentalOrderId' } } },
        ])
      : [],
    sIds.length
      ? SalesOrderDetail.aggregate([
          { $match: { salesOrderId: { $in: sIds } } },
          { $group: { _id: '$variantId', qty: { $sum: '$quantity' }, revenue: { $sum: '$lineTotal' }, orderIds: { $addToSet: '$salesOrderId' } } },
        ])
      : [],
  ]);

  const variantIds = [...new Set([...rentalDetails, ...salesDetails].map((d) => String(d._id)))].filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );
  if (!variantIds.length) return [];

  const variants = await ProductVariant.find({ _id: { $in: variantIds } }).populate('productId', 'name').lean();
  const variantToProduct = new Map(variants.filter((v) => v?.productId?._id).map((v) => [String(v._id), v.productId]));

  const productMap = new Map();
  const mergeChannel = (rows, channel) => {
    for (const row of rows) {
      const product = variantToProduct.get(String(row._id));
      if (!product) continue;
      const pid = String(product._id);
      if (!productMap.has(pid)) {
        productMap.set(pid, { productId: product._id, name: product.name, rentalCount: 0, salesCount: 0, revenue: 0, _orders: new Set() });
      }
      const entry = productMap.get(pid);
      const qty = Number(row.qty || 0);
      entry.revenue += Number(row.revenue || 0);
      if (channel === 'rental') entry.rentalCount += qty;
      else entry.salesCount += qty;
      for (const oid of row.orderIds || []) entry._orders.add(`${channel}:${oid}`);
    }
  };

  mergeChannel(rentalDetails, 'rental');
  mergeChannel(salesDetails, 'sale');

  const top = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue || b.rentalCount + b.salesCount - (a.rentalCount + a.salesCount))
    .slice(0, limit);
  if (!top.length) return [];

  const images = await ProductImage.find({ productId: { $in: top.map((p) => p.productId) } })
    .sort({ isPrimary: -1, displayOrder: 1 })
    .select('productId imageUrl')
    .lean();
  const imageMap = new Map();
  for (const img of images) {
    const pid = String(img.productId);
    if (!imageMap.has(pid) && img.imageUrl) imageMap.set(pid, img.imageUrl);
  }

  return top.map(({ _orders, ...item }) => ({
    ...item,
    orderCount: _orders.size,
    imageUrl: imageMap.get(String(item.productId)) || '',
  }));
}

async function buildRecentAndUpcomingOrders({ locationIds, now }) {
  const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const [recentRentals, recentSales, returnDocs] = await Promise.all([
    RentalOrder.find({ locationId: { $in: locationIds } })
      .sort({ createdAt: -1 })
      .limit(7)
      .select('orderCode rentalStatus rentalFee depositAmount createdAt customerId')
      .populate('customerId', 'FullName Information')
      .lean(),
    SalesOrder.find({ locationId: { $in: locationIds } })
      .sort({ createdAt: -1 })
      .limit(7)
      .select('orderCode orderStatus totalAmount createdAt customerId')
      .populate('customerId', 'FullName Information')
      .lean(),
    RentalOrder.find({
      locationId: { $in: locationIds },
      rentalStatus: { $in: Array.from(ACTIVE_RENTAL_STATUSES) },
      dueDate: { $lte: next48Hours },
    })
      .sort({ dueDate: 1 })
      .limit(6)
      .select('orderCode rentalStatus rentalFee dueDate createdAt customerId')
      .populate('customerId', 'FullName Information')
      .lean(),
  ]);

  const recentOrders = [
    ...recentRentals.map((o) => ({
      _id: o._id,
      orderCode: o.orderCode,
      orderType: 'rental',
      rentalStatus: o.rentalStatus,
      rentalFee: Number(o.rentalFee || 0),
      depositAmount: Number(o.depositAmount || 0),
      createdAt: o.createdAt,
      customer: extractCustomerInfo(o.customerId),
    })),
    ...recentSales.map((o) => ({
      _id: o._id,
      orderCode: o.orderCode,
      orderType: 'sale',
      orderStatus: o.orderStatus,
      totalAmount: Number(o.totalAmount || 0),
      createdAt: o.createdAt,
      customer: extractCustomerInfo(o.customerId),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 7);

  const upcomingReturns = returnDocs.map((o) => {
    const dueMs = new Date(o.dueDate).getTime();
    const hoursRemaining = Math.round((dueMs - now.getTime()) / (60 * 60 * 1000));
    return {
      _id: o._id,
      orderCode: o.orderCode,
      orderType: 'rental',
      rentalStatus: o.rentalStatus,
      rentalFee: Number(o.rentalFee || 0),
      dueDate: o.dueDate,
      createdAt: o.createdAt,
      isOverdue: o.rentalStatus === 'overdue' || dueMs < now.getTime(),
      hoursRemaining,
      customer: extractCustomerInfo(o.customerId),
    };
  });

  return { recentOrders, upcomingReturns };
}

/**
 * Lấy dữ liệu tổng quan & hiệu suất điều hành cho màn hình Branch Overview.
 */
export async function getBranchPerformanceReportData({ user, branchId = '', timeRange = 'MONTH' } = {}) {
  const now = new Date();
  const range = computeDateRange({ timeRange, now });
  const { prevStart, prevEnd } = computePreviousPeriod(range.timeRange, range.start, range.end);

  const shop = await resolveAuthorizedBranch(user, branchId);
  if (!shop) {
    return buildEmptyBranchReport({ hasAssignment: false, branch: null, locations: [], range });
  }

  // Chỉ lấy kho cửa hàng (type: 'store') của đúng chi nhánh này; tuyệt đối không lấy kho tổng ('warehouse') hay chi nhánh khác
  const locations = await InventoryLocation.find(buildStoreLocationFilter(shop._id))
    .select('_id name code')
    .lean();
  const locationIds = locations.map((loc) => loc._id);
  if (!locationIds.length) {
    return buildEmptyBranchReport({ hasAssignment: true, branch: shop, locations: [], range });
  }

  const [
    periodRentals,
    periodSales,
    prevRentals,
    prevSales,
    activeRentalsCount,
    overdueRentalsCount,
    heldDepositsAgg,
    pendingRentalCount,
    pendingSalesCount,
    disputesAgg,
    incomingTransfersToReceiveCount,
    failedShipmentsCount,
    stockBreakdown,
    ordersData,
  ] = await Promise.all([
    RentalOrder.find({ locationId: { $in: locationIds }, createdAt: { $gte: range.start, $lte: range.end } })
      .select('rentalStatus rentalFee createdAt')
      .lean(),
    SalesOrder.find({ locationId: { $in: locationIds }, createdAt: { $gte: range.start, $lte: range.end } })
      .select('orderStatus totalAmount createdAt')
      .lean(),
    RentalOrder.find({
      locationId: { $in: locationIds },
      createdAt: { $gte: prevStart, $lte: prevEnd },
      rentalStatus: { $nin: Array.from(EXCLUDED_REVENUE_STATUSES) },
    })
      .select('rentalFee')
      .lean(),
    SalesOrder.find({
      locationId: { $in: locationIds },
      createdAt: { $gte: prevStart, $lte: prevEnd },
      orderStatus: { $nin: Array.from(EXCLUDED_REVENUE_STATUSES) },
    })
      .select('totalAmount')
      .lean(),
    RentalOrder.countDocuments({ locationId: { $in: locationIds }, rentalStatus: { $in: Array.from(ACTIVE_RENTAL_STATUSES) } }),
    RentalOrder.countDocuments({
      locationId: { $in: locationIds },
      $or: [{ rentalStatus: 'overdue' }, { rentalStatus: { $in: ['renting', 'partially_returned'] }, dueDate: { $lt: now } }],
    }),
    RentalOrder.aggregate([
      { $match: { locationId: { $in: locationIds }, depositStatus: 'held' } },
      { $group: { _id: null, totalHeld: { $sum: '$depositAmount' } } },
    ]),
    RentalOrder.countDocuments({ locationId: { $in: locationIds }, rentalStatus: 'confirmed' }),
    SalesOrder.countDocuments({ locationId: { $in: locationIds }, orderStatus: { $in: ['confirmed', 'processing'] } }),
    RentalDispute.aggregate([
      { $match: { status: { $in: OPEN_DISPUTE_STATUSES } } },
      { $lookup: { from: RentalOrder.collection.name, localField: 'rentalOrderId', foreignField: '_id', as: 'order' } },
      { $unwind: '$order' },
      { $match: { 'order.locationId': { $in: locationIds } } },
      { $count: 'count' },
    ]),
    StockTransfer.countDocuments({ toLocationId: { $in: locationIds }, status: { $in: ['shipped', 'partially_received'] } }),
    OrderShipment.countDocuments({ $or: [{ fromLocationId: { $in: locationIds } }, { fromShopId: shop._id }], shipmentStatus: 'failed' }),
    aggregateBranchStock(locationIds),
    buildRecentAndUpcomingOrders({ locationIds, now }),
  ]);

  const summary = summarizePeriodOrders({ rentalOrders: periodRentals, salesOrders: periodSales });
  const prevRevenue =
    prevRentals.reduce((s, o) => s + Number(o.rentalFee || 0), 0) +
    prevSales.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const growth = computeGrowthRate(summary.totalRevenue, prevRevenue);
  const openDisputesCount = Number(disputesAgg?.[0]?.count || 0);
  const pendingHandoverCount = pendingRentalCount + pendingSalesCount;

  const topProducts = await aggregateTopProductsForBranch({
    rentalOrderIds: summary.validRentals.map((o) => o._id),
    salesOrderIds: summary.validSales.map((o) => o._id),
    limit: 5,
  });

  return {
    hasAssignment: true,
    branch: formatBranchSummary(shop),
    storeLocation: { _id: locations[0]._id, name: locations[0].name, code: locations[0].code || '' },
    locationsCount: locations.length,
    notice: buildTopNotice({ hasStoreLocation: true, overdueRentalsCount, openDisputesCount, pendingHandoverCount }),
    kpis: {
      totalRevenue: summary.totalRevenue,
      rentalRevenue: summary.rentalRevenue,
      salesRevenue: summary.salesRevenue,
      growthRate: growth.growthRate,
      hasGrowthBaseline: growth.hasBaseline,
      rentalOrdersCount: summary.rentalOrdersCount,
      salesOrdersCount: summary.salesOrdersCount,
      activeRentalsCount,
      overdueRentalsCount,
      heldDeposits: Number(heldDepositsAgg?.[0]?.totalHeld || 0),
    },
    operations: { pendingHandoverCount, openDisputesCount, incomingTransfersToReceiveCount, failedShipmentsCount },
    stockBreakdown,
    revenueSeries: buildRevenueSeries({ timeRange: range.timeRange, start: range.start, rentalOrders: periodRentals, salesOrders: periodSales }),
    topProducts,
    recentOrders: ordersData.recentOrders,
    upcomingReturns: ordersData.upcomingReturns,
  };
}
