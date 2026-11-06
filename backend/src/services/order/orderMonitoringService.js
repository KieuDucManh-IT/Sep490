import mongoose from 'mongoose';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../models/shop/Shop.js';
import User from '../../models/system/User.js';
import '../../models/masterdata/ProductVariant.js';
import '../../models/masterdata/Product.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const normalizeRole = (r) =>
  String(r || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace('brandmanager', 'branchmanager');

const isLocationAllowed = (scope, orderLocationId) => {
  if (!scope || !scope.locationFilter) return true;
  const targetId = String(orderLocationId?._id || orderLocationId || '');
  if (scope.locationFilter.$in && Array.isArray(scope.locationFilter.$in)) {
    return scope.locationFilter.$in.some((id) => String(id) === targetId);
  }
  return String(scope.locationFilter) === targetId;
};

export const resolveLocationScope = async (user, requestedBranchId = '') => {
  const role = normalizeRole(user?.Role || user?.role);

  if (role === 'branchmanager') {
    let shop;
    if (requestedBranchId) {
      if (!mongoose.isValidObjectId(requestedBranchId)) {
        throw fail('Mã chi nhánh không hợp lệ.', 400);
      }
      shop = await Shop.findOne({
        _id: requestedBranchId,
        managerId: user._id,
        isDeleted: { $ne: true },
      })
        .select('_id name code managerId address phone status isHQ')
        .lean();

      if (!shop) {
        throw fail('Bạn không có quyền truy cập dữ liệu đơn hàng của chi nhánh khác.', 403);
      }

      if (String(shop.managerId) !== String(user._id) || String(shop._id) !== String(requestedBranchId)) {
        throw fail('Bạn không có quyền truy cập dữ liệu đơn hàng của chi nhánh khác.', 403);
      }
    } else {
      const q1 = Shop.findOne({
        managerId: user._id,
        status: 'ACTIVE',
        isDeleted: { $ne: true },
      });
      if (typeof q1.sort === 'function') q1.sort({ createdAt: 1, _id: 1 });
      shop = await q1.select('_id name code managerId address phone status isHQ').lean();

      if (!shop) {
        const q2 = Shop.findOne({
          managerId: user._id,
          isDeleted: { $ne: true },
        });
        if (typeof q2.sort === 'function') q2.sort({ createdAt: 1, _id: 1 });
        shop = await q2.select('_id name code managerId address phone status isHQ').lean();
      }

      if (!shop) {
        throw fail('Tài khoản chưa được chỉ định chi nhánh vận hành đang hoạt động.', 403);
      }
    }

    let storeLocations = [];
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      storeLocations = (await InventoryLocation.find({
        shopId: shop._id,
        status: 'active',
      })
        .select('_id code name type shopId')
        .lean()) || [];
    }

    if (!storeLocations.length) {
      const single = await InventoryLocation.findOne({
        shopId: shop._id,
        type: 'store',
        status: 'active',
      })
        .select('_id code name type shopId')
        .lean();
      if (single) storeLocations = [single];
    }

    let locationFilter;
    if (storeLocations.length === 1) {
      locationFilter = storeLocations[0]._id;
    } else if (storeLocations.length > 1) {
      locationFilter = { $in: storeLocations.map((loc) => loc._id) };
    } else {
      locationFilter = new mongoose.Types.ObjectId();
    }

    return {
      locationFilter,
      shop,
      storeLocation: storeLocations[0] || null,
      storeLocations,
      isChainScope: false,
    };
  }

  if (['shopowner', 'owner', 'admin'].includes(role)) {
    if (requestedBranchId) {
      if (!mongoose.isValidObjectId(requestedBranchId)) {
        throw fail('Mã chi nhánh không hợp lệ.', 400);
      }

      const shop = await Shop.findById(requestedBranchId)
        .select('_id name code address phone isHQ')
        .lean();

      let storeLocations = [];
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        storeLocations = (await InventoryLocation.find({
          shopId: requestedBranchId,
          status: 'active',
        })
          .select('_id code name type shopId')
          .lean()) || [];
      }

      if (!storeLocations.length) {
        const single = await InventoryLocation.findOne({
          shopId: requestedBranchId,
          type: 'store',
          status: 'active',
        })
          .select('_id code name type shopId')
          .lean();
        if (single) storeLocations = [single];
      }

      let locationFilter;
      if (storeLocations.length === 1) {
        locationFilter = storeLocations[0]._id;
      } else if (storeLocations.length > 1) {
        locationFilter = { $in: storeLocations.map((loc) => loc._id) };
      } else {
        locationFilter = new mongoose.Types.ObjectId();
      }

      return {
        locationFilter,
        shop: shop || null,
        storeLocation: storeLocations[0] || null,
        storeLocations,
        isChainScope: false,
      };
    }

    return {
      locationFilter: null,
      shop: null,
      storeLocation: null,
      isChainScope: true,
    };
  }

  throw fail('Bạn không có quyền truy cập tính năng giám sát đơn hàng.', 403);
};

/**
 * Get Paginated List of Rental Orders with dynamic scoping
 */
export const getRentalOrders = async (user, query = {}) => {
  const { branchId, search, status, rentalStatus, fromDate, toDate } = query;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const scope = await resolveLocationScope(user, branchId);
  const filter = {};

  if (scope.locationFilter) {
    filter.locationId = scope.locationFilter;
  }

  const activeStatus = (status || rentalStatus || '').trim();
  if (activeStatus && activeStatus !== 'all') {
    filter.rentalStatus = activeStatus;
  }

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const trimmedSearch = (search || '').trim();
  if (trimmedSearch) {
    const matchedUsers = await User.find({
      $or: [
        { FullName: { $regex: trimmedSearch, $options: 'i' } },
        { Email: { $regex: trimmedSearch, $options: 'i' } },
        { 'Information.Phone': { $regex: trimmedSearch, $options: 'i' } },
      ],
    })
      .select('_id')
      .lean();

    const customerIds = matchedUsers.map((u) => u._id);
    filter.$or = [
      { orderCode: { $regex: trimmedSearch, $options: 'i' } },
      { customerId: { $in: customerIds } },
    ];
  }

  const [totalItems, orders] = await Promise.all([
    RentalOrder.countDocuments(filter),
    RentalOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'customerId',
        select: 'FullName Email AvatarUrl Information',
      })
      .populate({
        path: 'createdBy',
        select: 'FullName Email Role',
      })
      .populate({
        path: 'locationId',
        select: 'name code address type shopId',
        populate: {
          path: 'shopId',
          select: 'name code address phone isHQ',
        },
      })
      .lean(),
  ]);

  const orderIds = orders.map((o) => o._id);
  const details = orderIds.length
    ? await RentalOrderDetail.find({ rentalOrderId: { $in: orderIds } })
        .populate({
          path: 'variantId',
          select: 'sku variantName size color productId',
          populate: {
            path: 'productId',
            select: 'name productCode brand salePrice rentalPricePerDay images',
          },
        })
        .lean()
    : [];

  const detailsByOrderId = new Map();
  details.forEach((item) => {
    const key = String(item.rentalOrderId);
    if (!detailsByOrderId.has(key)) detailsByOrderId.set(key, []);
    detailsByOrderId.get(key).push(item);
  });

  const enrichedOrders = orders.map((ord) => ({
    ...ord,
    items: detailsByOrderId.get(String(ord._id)) || [],
    itemCount: (detailsByOrderId.get(String(ord._id)) || []).reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    ),
  }));

  return {
    orders: enrichedOrders,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
    },
    scope: {
      isChainScope: scope.isChainScope,
      shop: scope.shop,
      location: scope.storeLocation,
    },
  };
};

/**
 * Get Rental Order Details by ID
 */
export const getRentalOrderById = async (user, id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw fail('Mã đơn thuê không hợp lệ.', 400);
  }

  const order = await RentalOrder.findById(id)
    .populate({
      path: 'customerId',
      select: 'FullName Email AvatarUrl Information',
    })
    .populate({
      path: 'createdBy',
      select: 'FullName Email Role',
    })
    .populate({
      path: 'locationId',
      select: 'name code address type shopId',
      populate: {
        path: 'shopId',
        select: 'name code address phone managerId isHQ',
      },
    })
    .lean();

  if (!order) {
    throw fail('Không tìm thấy đơn thuê yêu cầu.', 404);
  }

  const scope = await resolveLocationScope(user);
  const isRentalManagerOfShop =
    order.locationId?.shopId?.managerId &&
    String(order.locationId.shopId.managerId) === String(user._id);

  if (!isRentalManagerOfShop && !isLocationAllowed(scope, order.locationId)) {
    throw fail('Bạn không có quyền truy cập đơn hàng của chi nhánh khác.', 403);
  }

  const [items, shipments] = await Promise.all([
    RentalOrderDetail.find({ rentalOrderId: order._id })
      .populate({
        path: 'variantId',
        select: 'sku variantName size color attributes productId',
        populate: {
          path: 'productId',
          select: 'name productCode brand material rentalPricePerDay deposit images',
        },
      })
      .lean(),
    OrderShipment.find({ orderType: 'rental', orderId: order._id })
      .populate({ path: 'createdBy', select: 'FullName Email' })
      .lean(),
  ]);

  return { order, items, shipments };
};

/**
 * Get Paginated List of Sales Orders with dynamic scoping
 */
export const getSalesOrders = async (user, query = {}) => {
  const { branchId, search, status, orderStatus, fromDate, toDate } = query;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const scope = await resolveLocationScope(user, branchId);
  const filter = {};

  if (scope.locationFilter) {
    filter.locationId = scope.locationFilter;
  }

  const activeStatus = (status || orderStatus || '').trim();
  if (activeStatus && activeStatus !== 'all') {
    filter.orderStatus = activeStatus;
  }

  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const trimmedSearch = (search || '').trim();
  if (trimmedSearch) {
    const matchedUsers = await User.find({
      $or: [
        { FullName: { $regex: trimmedSearch, $options: 'i' } },
        { Email: { $regex: trimmedSearch, $options: 'i' } },
        { 'Information.Phone': { $regex: trimmedSearch, $options: 'i' } },
      ],
    })
      .select('_id')
      .lean();

    const customerIds = matchedUsers.map((u) => u._id);
    filter.$or = [
      { orderCode: { $regex: trimmedSearch, $options: 'i' } },
      { customerId: { $in: customerIds } },
    ];
  }

  const [totalItems, orders] = await Promise.all([
    SalesOrder.countDocuments(filter),
    SalesOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'customerId',
        select: 'FullName Email AvatarUrl Information',
      })
      .populate({
        path: 'createdBy',
        select: 'FullName Email Role',
      })
      .populate({
        path: 'locationId',
        select: 'name code address type shopId',
        populate: {
          path: 'shopId',
          select: 'name code address phone isHQ',
        },
      })
      .lean(),
  ]);

  const orderIds = orders.map((o) => o._id);
  const details = orderIds.length
    ? await SalesOrderDetail.find({ salesOrderId: { $in: orderIds } })
        .populate({
          path: 'variantId',
          select: 'sku variantName size color productId',
          populate: {
            path: 'productId',
            select: 'name productCode brand salePrice images',
          },
        })
        .lean()
    : [];

  const detailsByOrderId = new Map();
  details.forEach((item) => {
    const key = String(item.salesOrderId);
    if (!detailsByOrderId.has(key)) detailsByOrderId.set(key, []);
    detailsByOrderId.get(key).push(item);
  });

  const enrichedOrders = orders.map((ord) => ({
    ...ord,
    items: detailsByOrderId.get(String(ord._id)) || [],
    itemCount: (detailsByOrderId.get(String(ord._id)) || []).reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    ),
  }));

  return {
    orders: enrichedOrders,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
    },
    scope: {
      isChainScope: scope.isChainScope,
      shop: scope.shop,
      location: scope.storeLocation,
    },
  };
};

/**
 * Get Sales Order Details by ID
 */
export const getSalesOrderById = async (user, id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw fail('Mã đơn bán không hợp lệ.', 400);
  }

  const order = await SalesOrder.findById(id)
    .populate({
      path: 'customerId',
      select: 'FullName Email AvatarUrl Information',
    })
    .populate({
      path: 'createdBy',
      select: 'FullName Email Role',
    })
    .populate({
      path: 'locationId',
      select: 'name code address type shopId',
      populate: {
        path: 'shopId',
        select: 'name code address phone managerId isHQ',
      },
    })
    .lean();

  if (!order) {
    throw fail('Không tìm thấy đơn bán yêu cầu.', 404);
  }

  const scope = await resolveLocationScope(user);
  const isRentalManagerOfShop =
    order.locationId?.shopId?.managerId &&
    String(order.locationId.shopId.managerId) === String(user._id);

  if (!isRentalManagerOfShop && !isLocationAllowed(scope, order.locationId)) {
    throw fail('Bạn không có quyền truy cập đơn hàng của chi nhánh khác.', 403);
  }

  const [items, shipments] = await Promise.all([
    SalesOrderDetail.find({ salesOrderId: order._id })
      .populate({
        path: 'variantId',
        select: 'sku variantName size color attributes productId',
        populate: {
          path: 'productId',
          select: 'name productCode brand material salePrice images',
        },
      })
      .lean(),
    OrderShipment.find({ orderType: 'sale', orderId: order._id })
      .populate({ path: 'createdBy', select: 'FullName Email' })
      .lean(),
  ]);

  return { order, items, shipments };
};

/**
 * Get Order Metrics (KPI overview) for Rentals and Sales
 */
export const getOrderMetrics = async (user, { branchId = '' } = {}) => {
  const scope = await resolveLocationScope(user, branchId);
  const matchRental = scope.locationFilter ? { locationId: scope.locationFilter } : {};
  const matchSales = scope.locationFilter ? { locationId: scope.locationFilter } : {};

  const [rentalAgg, salesAgg] = await Promise.all([
    RentalOrder.aggregate([
      { $match: matchRental },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$rentalStatus', count: { $sum: 1 } } },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalRentals: { $sum: 1 },
                totalRentalFee: { $sum: '$rentalFee' },
                totalDepositAmount: { $sum: '$depositAmount' },
              },
            },
          ],
          escrowHeld: [
            { $match: { depositStatus: 'held' } },
            { $group: { _id: null, totalEscrowHeld: { $sum: '$depositAmount' } } },
          ],
        },
      },
    ]),
    SalesOrder.aggregate([
      { $match: matchSales },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalSales: { $sum: 1 },
                totalAmount: { $sum: '$totalAmount' },
              },
            },
          ],
          completedRevenue: [
            { $match: { orderStatus: 'completed' } },
            { $group: { _id: null, completedRevenue: { $sum: '$totalAmount' } } },
          ],
        },
      },
    ]),
  ]);

  const rentalStatusMap = {};
  (rentalAgg[0]?.byStatus || []).forEach((item) => {
    rentalStatusMap[item._id] = item.count;
  });

  const salesStatusMap = {};
  (salesAgg[0]?.byStatus || []).forEach((item) => {
    salesStatusMap[item._id] = item.count;
  });

  return {
    rentalMetrics: {
      total: rentalAgg[0]?.totals[0]?.totalRentals || 0,
      totalRentalFee: rentalAgg[0]?.totals[0]?.totalRentalFee || 0,
      totalDepositAmount: rentalAgg[0]?.totals[0]?.totalDepositAmount || 0,
      totalEscrowHeld: rentalAgg[0]?.escrowHeld[0]?.totalEscrowHeld || 0,
      draft: rentalStatusMap.draft || 0,
      confirmed: rentalStatusMap.confirmed || 0,
      renting: rentalStatusMap.renting || 0,
      partially_returned: rentalStatusMap.partially_returned || 0,
      returned: rentalStatusMap.returned || 0,
      cancelled: rentalStatusMap.cancelled || 0,
      overdue: rentalStatusMap.overdue || 0,
    },
    salesMetrics: {
      total: salesAgg[0]?.totals[0]?.totalSales || 0,
      totalAmount: salesAgg[0]?.totals[0]?.totalAmount || 0,
      completedRevenue: salesAgg[0]?.completedRevenue[0]?.completedRevenue || 0,
      draft: salesStatusMap.draft || 0,
      confirmed: salesStatusMap.confirmed || 0,
      processing: salesStatusMap.processing || 0,
      completed: salesStatusMap.completed || 0,
      cancelled: salesStatusMap.cancelled || 0,
    },
    scope: {
      isChainScope: scope.isChainScope,
      shop: scope.shop,
      location: scope.storeLocation,
    },
  };
};

