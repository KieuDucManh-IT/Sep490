import mongoose from 'mongoose';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../models/shop/Shop.js';
import User from '../../models/system/User.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Product } from '../../models/masterdata/Product.js';
import { Wallet } from '../../models/finance/Wallet.js';
import { WalletTransaction } from '../../models/finance/WalletTransaction.js';
import { readBalances } from '../walletService.js';
import { encryptValue } from '../../utils/walletSecurity.js';
import { syncSingleShipmentFromGHN } from '../shipping/shipmentSyncService.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/**
 * Chọn ra vận đơn đại diện đang hoạt động cho đơn hàng
 * Chỉ lấy vận đơn chưa hủy (preparing, shipped, delivered)
 * Nếu tất cả vận đơn đều đã hủy -> trả về null để đơn hàng hiển thị đúng trạng thái vòng đời của đơn
 */
export const resolvePrimaryShipment = (list = []) => {
  if (!Array.isArray(list) || !list.length) return null;
  const active = list.filter((s) => s && ['preparing', 'shipped', 'delivered'].includes(s.shipmentStatus));
  if (active.length > 0) {
    const withCode = active.find((s) => Boolean(s.trackingCode && !s.trackingCode.startsWith('TRK-') && !s.trackingCode.startsWith('SHP-')));
    return withCode || active[0];
  }
  return null;
};

const attachProductImages = async (details = []) => {
  if (!details || !details.length) return details;
  const productIds = [];
  const variantIds = [];
  for (const d of details) {
    if (d.variantId?._id) variantIds.push(d.variantId._id);
    const pId = d.variantId?.productId?._id || d.variantId?.productId;
    if (pId) productIds.push(pId);
  }

  if (!productIds.length && !variantIds.length) return details;

  const images = await ProductImage.find({
    $or: [
      { productId: { $in: productIds } },
      { variantId: { $in: variantIds } },
    ],
  })
    .sort({ isPrimary: -1, displayOrder: 1, createdAt: 1 })
    .lean();

  const imageByProduct = new Map();
  const imageByVariant = new Map();
  const allImagesByProduct = new Map();

  for (const img of images) {
    const url = img.imageUrl || img.image_url || '';
    if (!url) continue;
    const vId = img.variantId || img.variant_id;
    const pId = img.productId || img.product_id;

    if (vId && !imageByVariant.has(String(vId))) {
      imageByVariant.set(String(vId), url);
    }
    if (pId) {
      const pIdStr = String(pId);
      if (!imageByProduct.has(pIdStr)) {
        imageByProduct.set(pIdStr, url);
      }
      if (!allImagesByProduct.has(pIdStr)) {
        allImagesByProduct.set(pIdStr, []);
      }
      allImagesByProduct.get(pIdStr).push(url);
    }
  }

  for (const d of details) {
    const vId = d.variantId?._id ? String(d.variantId._id) : (d.variantId ? String(d.variantId) : '');
    const pId = d.variantId?.productId?._id
      ? String(d.variantId.productId._id)
      : (d.variantId?.productId ? String(d.variantId.productId) : (d.productId?._id ? String(d.productId._id) : (d.productId ? String(d.productId) : '')));

    const productImagesList = (pId && allImagesByProduct.get(pId)) || [];
    const itemImage =
      (vId && imageByVariant.get(vId)) ||
      (pId && imageByProduct.get(pId)) ||
      (Array.isArray(d.variantId?.productId?.images) && d.variantId.productId.images[0]) ||
      d.variantId?.productId?.image ||
      d.variantId?.image ||
      d.image ||
      '';

    d.image = itemImage;
    d.imageUrl = itemImage;
    if (d.variantId && typeof d.variantId === 'object') {
      d.variantId.image = itemImage;
      d.variantId.imageUrl = itemImage;
      if (d.variantId.productId && typeof d.variantId.productId === 'object') {
        d.variantId.productId.image = itemImage;
        d.variantId.productId.imageUrl = itemImage;
        d.variantId.productId.images = productImagesList.length > 0 ? productImagesList : (itemImage ? [itemImage] : []);
      }
    }
  }

  return details;
};

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
    if (activeStatus === 'overdue') {
      filter.$or = [
        { rentalStatus: 'overdue' },
        { rentalStatus: 'renting', dueDate: { $lt: new Date() } },
      ];
    } else if (activeStatus === 'confirmed') {
      filter.rentalStatus = { $in: ['confirmed', 'draft'] };
    } else {
      filter.rentalStatus = activeStatus;
    }
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
  const [details, shipments] = await Promise.all([
    orderIds.length
      ? RentalOrderDetail.find({ rentalOrderId: { $in: orderIds } })
          .populate({
            path: 'variantId',
            select: 'sku variantName size color productId',
            populate: {
              path: 'productId',
              select: 'name productCode brand salePrice rentalPricePerDay images',
            },
          })
          .lean()
      : [],
    orderIds.length
      ? OrderShipment.find({ orderId: { $in: orderIds } })
          .sort({ createdAt: -1 })
          .lean()
      : [],
  ]);

  // Đồng bộ nhanh các vận đơn đang trong hành trình (preparing, shipped) từ GHN
  const activeShipments = shipments.filter(
    (s) => s.trackingCode && ['preparing', 'shipped'].includes(s.shipmentStatus)
  );
  if (activeShipments.length > 0) {
    const synced = await Promise.all(
      activeShipments.map((s) => syncSingleShipmentFromGHN(s).catch(() => null))
    );
    synced.forEach((updated) => {
      if (updated && updated._id) {
        const idx = shipments.findIndex((s) => String(s._id) === String(updated._id));
        if (idx !== -1) {
          shipments[idx] = updated.toObject ? updated.toObject() : updated;
        }
      }
    });
  }

  await attachProductImages(details);

  const detailsByOrderId = new Map();
  details.forEach((item) => {
    const key = String(item.rentalOrderId);
    if (!detailsByOrderId.has(key)) detailsByOrderId.set(key, []);
    detailsByOrderId.get(key).push(item);
  });

  const shipmentsByOrderId = new Map();
  shipments.forEach((s) => {
    const key = String(s.orderId);
    if (!shipmentsByOrderId.has(key)) shipmentsByOrderId.set(key, []);
    shipmentsByOrderId.get(key).push(s);
  });

  const enrichedOrders = orders.map((ord) => {
    const ordShipments = shipmentsByOrderId.get(String(ord._id)) || [];
    return {
      ...ord,
      items: detailsByOrderId.get(String(ord._id)) || [],
      itemCount: (detailsByOrderId.get(String(ord._id)) || []).reduce(
        (sum, item) => sum + (item.quantity || 1),
        0
      ),
      shipments: ordShipments,
      shipment: resolvePrimaryShipment(ordShipments),
    };
  });

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

  let order = await RentalOrder.findById(id)
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
      .populate({ path: 'createdBy', select: 'FullName Email' }),
  ]);

  const activeShipments = shipments.filter((s) => s.trackingCode && ['preparing', 'shipped'].includes(s.shipmentStatus));
  if (activeShipments.length > 0) {
    const synced = await Promise.all(
      activeShipments.map((s) => syncSingleShipmentFromGHN(s).catch(() => null))
    );
    synced.forEach((updated) => {
      if (updated && updated._id) {
        const idx = shipments.findIndex((s) => String(s._id) === String(updated._id));
        if (idx !== -1) shipments[idx] = updated;
      }
    });

    const freshOrder = await RentalOrder.findById(order._id)
      .populate({ path: 'customerId', select: 'FullName Email AvatarUrl Information' })
      .populate({
        path: 'locationId',
        select: 'name code address type shopId',
        populate: { path: 'shopId', select: 'name code address phone isHQ' },
      })
      .lean();
    if (freshOrder) order = freshOrder;
  }

  const resolvedShipments = shipments.map((s) => (s.toObject ? s.toObject() : s));
  const primaryShipment = resolvePrimaryShipment(resolvedShipments);
  order.shipments = resolvedShipments;
  order.shipment = primaryShipment;
  await attachProductImages(items);

  return { order, items, shipments: resolvedShipments, shipment: primaryShipment };
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
    if (activeStatus === 'confirmed') {
      filter.orderStatus = { $in: ['confirmed', 'draft'] };
    } else {
      filter.orderStatus = activeStatus;
    }
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
  const [details, shipments] = await Promise.all([
    orderIds.length
      ? SalesOrderDetail.find({ salesOrderId: { $in: orderIds } })
          .populate({
            path: 'variantId',
            select: 'sku variantName size color productId',
            populate: {
              path: 'productId',
              select: 'name productCode brand salePrice images',
            },
          })
          .lean()
      : [],
    orderIds.length
      ? OrderShipment.find({ orderId: { $in: orderIds } })
          .sort({ createdAt: -1 })
          .lean()
      : [],
  ]);

  // Đồng bộ nhanh các vận đơn đang trong hành trình (preparing, shipped) từ GHN
  const activeShipments = shipments.filter(
    (s) => s.trackingCode && ['preparing', 'shipped'].includes(s.shipmentStatus)
  );
  if (activeShipments.length > 0) {
    const synced = await Promise.all(
      activeShipments.map((s) => syncSingleShipmentFromGHN(s).catch(() => null))
    );
    synced.forEach((updated) => {
      if (updated && updated._id) {
        const idx = shipments.findIndex((s) => String(s._id) === String(updated._id));
        if (idx !== -1) {
          shipments[idx] = updated.toObject ? updated.toObject() : updated;
        }
      }
    });
  }

  await attachProductImages(details);

  const detailsByOrderId = new Map();
  details.forEach((item) => {
    const key = String(item.salesOrderId);
    if (!detailsByOrderId.has(key)) detailsByOrderId.set(key, []);
    detailsByOrderId.get(key).push(item);
  });

  const shipmentsByOrderId = new Map();
  shipments.forEach((s) => {
    const key = String(s.orderId);
    if (!shipmentsByOrderId.has(key)) shipmentsByOrderId.set(key, []);
    shipmentsByOrderId.get(key).push(s);
  });

  const enrichedOrders = orders.map((ord) => {
    const ordShipments = shipmentsByOrderId.get(String(ord._id)) || [];
    return {
      ...ord,
      items: detailsByOrderId.get(String(ord._id)) || [],
      itemCount: (detailsByOrderId.get(String(ord._id)) || []).reduce(
        (sum, item) => sum + (item.quantity || 1),
        0
      ),
      shipments: ordShipments,
      shipment: resolvePrimaryShipment(ordShipments),
    };
  });

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

  let order = await SalesOrder.findById(id)
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
      .populate({ path: 'createdBy', select: 'FullName Email' }),
  ]);

  const activeShipments = shipments.filter((s) => s.trackingCode && ['preparing', 'shipped'].includes(s.shipmentStatus));
  if (activeShipments.length > 0) {
    const synced = await Promise.all(
      activeShipments.map((s) => syncSingleShipmentFromGHN(s).catch(() => null))
    );
    synced.forEach((updated) => {
      if (updated && updated._id) {
        const idx = shipments.findIndex((s) => String(s._id) === String(updated._id));
        if (idx !== -1) shipments[idx] = updated;
      }
    });

    const freshOrder = await SalesOrder.findById(order._id)
      .populate({ path: 'customerId', select: 'FullName Email AvatarUrl Information' })
      .populate({
        path: 'locationId',
        select: 'name code address type shopId',
        populate: { path: 'shopId', select: 'name code address phone managerId isHQ' },
      })
      .lean();
    if (freshOrder) order = freshOrder;
  }

  const resolvedShipments = shipments.map((s) => (s.toObject ? s.toObject() : s));
  const primaryShipment = resolvePrimaryShipment(resolvedShipments);
  order.shipments = resolvedShipments;
  order.shipment = primaryShipment;

  return { order, items, shipments: resolvedShipments, shipment: primaryShipment };
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

  const overdueCount = await RentalOrder.countDocuments({
    ...matchRental,
    $or: [
      { rentalStatus: 'overdue' },
      { rentalStatus: 'renting', dueDate: { $lt: new Date() } },
    ],
  });

  return {
    rentalMetrics: {
      total: rentalAgg[0]?.totals[0]?.totalRentals || 0,
      totalRentalFee: rentalAgg[0]?.totals[0]?.totalRentalFee || 0,
      totalDepositAmount: rentalAgg[0]?.totals[0]?.totalDepositAmount || 0,
      totalDepositHeld: rentalAgg[0]?.escrowHeld[0]?.totalEscrowHeld || 0,
      totalEscrowHeld: rentalAgg[0]?.escrowHeld[0]?.totalEscrowHeld || 0,
      draft: rentalStatusMap.draft || 0,
      confirmed: (rentalStatusMap.confirmed || 0) + (rentalStatusMap.draft || 0),
      renting: rentalStatusMap.renting || 0,
      partially_returned: rentalStatusMap.partially_returned || 0,
      returned: rentalStatusMap.returned || 0,
      cancelled: rentalStatusMap.cancelled || 0,
      overdue: overdueCount,
    },
    salesMetrics: {
      total: salesAgg[0]?.totals[0]?.totalSales || 0,
      totalAmount: salesAgg[0]?.totals[0]?.totalAmount || 0,
      completedRevenue: salesAgg[0]?.completedRevenue[0]?.completedRevenue || 0,
      draft: salesStatusMap.draft || 0,
      confirmed: (salesStatusMap.confirmed || 0) + (salesStatusMap.draft || 0),
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

export const getCustomerRentalOrders = async (user, query = {}) => {
  if (!user?._id) throw fail('Vui lòng đăng nhập để xem đơn thuê.', 401);

  const filter = { customerId: user._id };
  if (query.status && query.status !== 'all') {
    if (query.status === 'overdue') {
      filter.$or = [
        { rentalStatus: 'overdue' },
        { rentalStatus: 'renting', dueDate: { $lt: new Date() } },
      ];
    } else if (query.status === 'confirmed') {
      filter.rentalStatus = { $in: ['confirmed', 'draft'] };
    } else if (query.status === 'returned') {
      filter.rentalStatus = { $in: ['returned', 'partially_returned'] };
    } else {
      filter.rentalStatus = query.status;
    }
  }
  if (query.search && String(query.search).trim()) {
    filter.orderCode = { $regex: String(query.search).trim(), $options: 'i' };
  }

  const orders = await RentalOrder.find(filter)
    .sort({ createdAt: -1 })
    .populate('locationId', 'name address phone')
    .lean();

  const orderIds = orders.map((o) => o._id);
  const details = await RentalOrderDetail.find({ rentalOrderId: { $in: orderIds } })
    .populate({
      path: 'variantId',
      populate: { path: 'productId' },
    })
    .lean();

  await attachProductImages(details);

  const shipments = await OrderShipment.find({ orderId: { $in: orderIds } })
    .sort({ createdAt: -1 })
    .lean();

  // Đồng bộ nhanh các vận đơn đang trong hành trình từ GHN
  const activeShipments = shipments.filter(
    (s) => s.trackingCode && ['preparing', 'shipped'].includes(s.shipmentStatus)
  );
  if (activeShipments.length > 0) {
    const synced = await Promise.all(
      activeShipments.map((s) => syncSingleShipmentFromGHN(s).catch(() => null))
    );
    synced.forEach((updated) => {
      if (updated && updated._id) {
        const idx = shipments.findIndex((s) => String(s._id) === String(updated._id));
        if (idx !== -1) {
          shipments[idx] = updated.toObject ? updated.toObject() : updated;
        }
      }
    });
  }

  const detailsByOrder = {};
  for (const d of details) {
    const oid = String(d.rentalOrderId);
    if (!detailsByOrder[oid]) detailsByOrder[oid] = [];
    detailsByOrder[oid].push(d);
  }

  const shipmentsByOrder = {};
  for (const s of shipments) {
    const oid = String(s.orderId);
    if (!shipmentsByOrder[oid]) shipmentsByOrder[oid] = [];
    shipmentsByOrder[oid].push(s);
  }

  return orders.map((o) => {
    const ordShipments = shipmentsByOrder[String(o._id)] || [];
    return {
      ...o,
      items: detailsByOrder[String(o._id)] || [],
      shipments: ordShipments,
      shipment: resolvePrimaryShipment(ordShipments),
    };
  });
};

export const createCustomerCheckoutOrder = async (user, data = {}) => {
  if (!user?._id) throw fail('Vui lòng đăng nhập để tiến hành đặt hàng.', 401);
  const {
    items = [],
    recipientName,
    phone,
    address,
    province,
    district,
    ward,
    deliveryMethod = 'delivery',
    paymentMethod = 'payos',
    note,
  } = data;
  if (!items || !items.length) throw fail('Không có sản phẩm nào được chọn để thanh toán.', 400);

  // 1. Xác định địa điểm chi nhánh thực tế từ MongoDB Atlas
  let locationId = items[0]?.selectedBranch?.locationId;
  if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
    const loc = await InventoryLocation.findOne({ isDeleted: { $ne: true } }).lean();
    locationId = loc?._id;
  }
  if (!locationId) {
    const activeShop = await Shop.findOne({ status: 'ACTIVE', isDeleted: { $ne: true } }).lean();
    if (activeShop) {
      const loc = await InventoryLocation.findOne({ shopId: activeShop._id }).lean();
      locationId = loc?._id;
    }
  }

  const customerName = recipientName || user.FullName || user.name || 'Khách hàng';
  const customerPhone = phone || user.Phone || user.phone || '0901234567';
  const fullAddress = [address, ward, district, province].filter(Boolean).join(', ') || address || 'Nhận tại Showroom';

  const structuredShippingAddress = deliveryMethod === 'pickup'
    ? {
        deliveryMethod: 'pickup',
        receiverName: customerName,
        phone: customerPhone,
        address: 'Nhận tại Showroom Vestora',
      }
    : {
        deliveryMethod: 'delivery',
        receiverName: customerName,
        phone: customerPhone,
        address: fullAddress,
        street: address || '',
        ward: ward || '',
        district: district || '',
        city: province || data.city || '',
        province: province || data.city || '',
        provinceId: Number(data.provinceId) || null,
        districtId: Number(data.districtId) || null,
        wardCode: data.wardCode ? String(data.wardCode) : null,
      };

  const deliveryNote = deliveryMethod === 'pickup'
    ? '[Nhận tại Showroom Vestora]'
    : `[Giao tận nơi: ${customerName} - ${customerPhone} - ${fullAddress}]`;
  const combinedNote = [deliveryNote, note].filter(Boolean).join(' | ');

  // Tách các món Thuê và Mua
  const rentalItems = items.filter((it) => it.isRental !== false);
  const saleItems = items.filter((it) => it.isRental === false);

  // Ràng buộc quy định thanh toán:
  // - Đơn thuê: Chỉ có duy nhất 1 hình thức thanh toán qua ví (wallet)
  // - Đơn mua: Có 2 hình thức thanh toán là COD hoặc qua ví (wallet)
  let appliedPaymentMethod = paymentMethod;
  if (rentalItems.length > 0) {
    appliedPaymentMethod = 'wallet';
  } else if (!['wallet', 'cod'].includes(appliedPaymentMethod)) {
    appliedPaymentMethod = 'cod';
  }

  // Tính trước tổng tiền đơn thuê và đơn mua
  let totalRentalFee = 0;
  let totalDeposit = 0;
  let rentalStartDate = new Date();
  let rentalDueDate = new Date();
  rentalDueDate.setDate(rentalDueDate.getDate() + 3);

  if (rentalItems.length > 0) {
    for (const it of rentalItems) {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const price = Number(it.price) || 0;
      const dep = Number(it.deposit) || 0;
      totalRentalFee += price * qty;
      totalDeposit += dep * qty;

      if (it.startDate) {
        const s = new Date(it.startDate);
        if (!isNaN(s.getTime())) rentalStartDate = s;
      }
      if (it.endDate) {
        const e = new Date(it.endDate);
        if (!isNaN(e.getTime())) rentalDueDate = e;
      } else if (it.duration) {
        const d = new Date(rentalStartDate);
        d.setDate(d.getDate() + Number(it.duration));
        rentalDueDate = d;
      }
    }
  }

  let totalSaleAmount = 0;
  if (saleItems.length > 0) {
    for (const it of saleItems) {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const price = Number(it.price) || 0;
      totalSaleAmount += price * qty;
    }
  }

  // Kiểm tra số dư ví nếu có phần thanh toán qua ví
  const needsWalletForRental = rentalItems.length > 0;
  const needsWalletForSale = saleItems.length > 0 && appliedPaymentMethod === 'wallet';
  const totalWalletNeeded =
    (needsWalletForRental ? totalRentalFee + totalDeposit : 0) +
    (needsWalletForSale ? totalSaleAmount : 0);

  let walletDoc = null;
  let currentBalances = null;

  if (totalWalletNeeded > 0) {
    walletDoc = await Wallet.findOne({ userId: user._id }).select('+balanceEncrypted +lockedBalanceEncrypted');
    if (!walletDoc) {
      throw fail('Không tìm thấy Ví điện tử Vestora của bạn. Vui lòng vào mục Ví để kích hoạt.', 400);
    }
    if (walletDoc.status !== 'active') {
      throw fail('Ví điện tử Vestora của bạn đang bị khóa hoặc chưa hoạt động.', 400);
    }

    currentBalances = readBalances(walletDoc);
    if (currentBalances.availableBalance < totalWalletNeeded) {
      throw fail(
        `Số dư khả dụng trong ví (${Number(currentBalances.availableBalance).toLocaleString('vi-VN')} ₫) không đủ để thanh toán (${Number(totalWalletNeeded).toLocaleString('vi-VN')} ₫). Vui lòng nạp thêm tiền vào ví để hoàn tất đặt hàng.`,
        400
      );
    }
  }

  let createdRentalOrder = null;
  let createdSalesOrder = null;

  // Xử lý đơn THUÊ (Rental) nếu có sản phẩm thuê
  if (rentalItems.length > 0) {
    const orderCode = `RNT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    createdRentalOrder = await RentalOrder.create({
      orderCode,
      locationId,
      customerId: user._id,
      createdBy: user._id,
      rentalStatus: 'confirmed',
      paymentStatus: 'paid', // Đơn thuê thanh toán qua ví luôn paid
      deliveryMethod,
      shippingAddress: structuredShippingAddress,
      paymentMethod: appliedPaymentMethod,
      paidAmount: totalRentalFee + totalDeposit,
      startDate: rentalStartDate,
      dueDate: rentalDueDate,
      rentalFee: totalRentalFee,
      depositAmount: totalDeposit,
      depositStatus: totalDeposit > 0 ? 'held' : 'pending',
      note: note || combinedNote,
    });

    for (const it of rentalItems) {
      let variantId = it.variantId;
      if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
        const pId = it.productId;
        if (pId && mongoose.Types.ObjectId.isValid(pId)) {
          const foundVariant = await ProductVariant.findOne({ productId: pId, isDeleted: { $ne: true } }).lean();
          if (foundVariant) variantId = foundVariant._id;
        }
      }
      if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
        let pId = it.productId;
        if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
          const anyProd = await Product.findOne().lean();
          pId = anyProd?._id;
        }
        if (pId) {
          const foundVariant = await ProductVariant.findOne({ productId: pId }).lean();
          if (foundVariant) {
            variantId = foundVariant._id;
          } else {
            const newVar = await ProductVariant.create({
              productId: pId,
              sku: `SKU-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
              size: it.size || 'M',
              color: it.color || 'Mặc định',
            });
            variantId = newVar._id;
          }
        }
      }

      if (!variantId) {
        const anyVar = await ProductVariant.findOne().lean();
        variantId = anyVar?._id || new mongoose.Types.ObjectId();
      }

      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Number(it.price) || 0;
      await RentalOrderDetail.create({
        rentalOrderId: createdRentalOrder._id,
        variantId,
        quantity: qty,
        unitRentalFee: unitPrice,
        lineTotal: unitPrice * qty,
        depositPerUnit: Number(it.deposit) || 0,
        startDate: rentalStartDate,
        dueDate: rentalDueDate,
        note: it.size ? `Kích thước: ${it.size}` : '',
      });
    }
  }

  // Xử lý đơn MUA (Sale) nếu có sản phẩm mua
  if (saleItems.length > 0) {
    const orderCode = `SAL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    createdSalesOrder = await SalesOrder.create({
      orderCode,
      locationId,
      customerId: user._id,
      createdBy: user._id,
      orderStatus: 'confirmed',
      paymentStatus: appliedPaymentMethod === 'cod' ? 'unpaid' : 'paid',
      deliveryMethod,
      shippingAddress: structuredShippingAddress,
      paymentMethod: appliedPaymentMethod,
      paidAmount: appliedPaymentMethod === 'cod' ? 0 : totalSaleAmount,
      subtotal: totalSaleAmount,
      discountAmount: 0,
      totalAmount: totalSaleAmount,
      confirmedAt: new Date(),
      note: note || combinedNote,
    });

    for (const it of saleItems) {
      let variantId = it.variantId;
      if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
        const pId = it.productId;
        if (pId && mongoose.Types.ObjectId.isValid(pId)) {
          const foundVariant = await ProductVariant.findOne({ productId: pId, isDeleted: { $ne: true } }).lean();
          if (foundVariant) variantId = foundVariant._id;
        }
      }
      if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
        let pId = it.productId;
        if (!pId || !mongoose.Types.ObjectId.isValid(pId)) {
          const anyProd = await Product.findOne().lean();
          pId = anyProd?._id;
        }
        if (pId) {
          const foundVariant = await ProductVariant.findOne({ productId: pId }).lean();
          if (foundVariant) {
            variantId = foundVariant._id;
          } else {
            const newVar = await ProductVariant.create({
              productId: pId,
              sku: `SKU-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
              size: it.size || 'M',
              color: it.color || 'Mặc định',
            });
            variantId = newVar._id;
          }
        }
      }

      if (!variantId) {
        const anyVar = await ProductVariant.findOne().lean();
        variantId = anyVar?._id || new mongoose.Types.ObjectId();
      }

      const qty = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Number(it.price) || 0;
      await SalesOrderDetail.create({
        salesOrderId: createdSalesOrder._id,
        variantId,
        quantity: qty,
        unitPrice,
        discountAmount: 0,
        lineTotal: unitPrice * qty,
      });
    }
  }

  // Thực hiện trừ tiền ví và tạo WalletTransaction
  if (walletDoc && totalWalletNeeded > 0) {
    try {
      let nextBalance = currentBalances.balance;
      let nextLocked = currentBalances.lockedBalance;

      if (needsWalletForRental) {
        nextBalance -= totalRentalFee;
        nextLocked += totalDeposit;
      }

      if (needsWalletForSale) {
        nextBalance -= totalSaleAmount;
      }

      walletDoc.balanceEncrypted = encryptValue(nextBalance, `${walletDoc._id}:balance`);
      walletDoc.lockedBalanceEncrypted = encryptValue(nextLocked, `${walletDoc._id}:locked`);
      await walletDoc.save();

      // Tạo giao dịch WalletTransaction cho đơn thuê
      if (createdRentalOrder) {
        if (totalRentalFee > 0) {
          const payCode = `PAY-RNT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await WalletTransaction.create({
            walletId: walletDoc._id,
            userId: user._id,
            code: payCode,
            transactionType: 'rental_payment',
            direction: 'debit',
            amount: Math.round(totalRentalFee),
            status: 'success',
            referenceType: 'RentalOrder',
            referenceId: createdRentalOrder._id,
            completedAt: new Date(),
          });
        }

        if (totalDeposit > 0) {
          const depCode = `DEP-RNT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await WalletTransaction.create({
            walletId: walletDoc._id,
            userId: user._id,
            code: depCode,
            transactionType: 'rental_deposit',
            direction: 'debit',
            amount: Math.round(totalDeposit),
            status: 'success',
            referenceType: 'RentalOrder',
            referenceId: createdRentalOrder._id,
            completedAt: new Date(),
          });
        }
      }

      // Tạo giao dịch WalletTransaction cho đơn mua
      if (createdSalesOrder && needsWalletForSale && totalSaleAmount > 0) {
        const saleCode = `PAY-SAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await WalletTransaction.create({
          walletId: walletDoc._id,
          userId: user._id,
          code: saleCode,
          transactionType: 'payment',
          direction: 'debit',
          amount: Math.round(totalSaleAmount),
          status: 'success',
          referenceType: 'SalesOrder',
          referenceId: createdSalesOrder._id,
          completedAt: new Date(),
        });
      }
    } catch (walletErr) {
      console.error('[Checkout] Lỗi trừ tiền ví hoặc tạo WalletTransaction:', walletErr);
    }
  }

  return {
    rentalOrder: createdRentalOrder,
    salesOrder: createdSalesOrder,
    order: createdRentalOrder || createdSalesOrder,
  };
};

export const createCustomerRentalOrder = createCustomerCheckoutOrder;

export const getCustomerSalesOrders = async (user, query = {}) => {
  if (!user?._id) throw fail('Vui lòng đăng nhập để xem đơn mua.', 401);

  const filter = { customerId: user._id };
  if (query.status && query.status !== 'all') {
    if (query.status === 'confirmed') {
      filter.orderStatus = { $in: ['confirmed', 'draft'] };
    } else {
      filter.orderStatus = query.status;
    }
  }
  if (query.search && String(query.search).trim()) {
    filter.orderCode = { $regex: String(query.search).trim(), $options: 'i' };
  }

  const orders = await SalesOrder.find(filter)
    .sort({ createdAt: -1 })
    .populate('locationId', 'name address phone')
    .lean();

  const orderIds = orders.map((o) => o._id);
  const details = await SalesOrderDetail.find({ salesOrderId: { $in: orderIds } })
    .populate({
      path: 'variantId',
      populate: { path: 'productId' },
    })
    .lean();

  await attachProductImages(details);

  const shipments = await OrderShipment.find({ orderId: { $in: orderIds } })
    .sort({ createdAt: -1 })
    .lean();

  // Đồng bộ nhanh các vận đơn đang trong hành trình từ GHN
  const activeShipments = shipments.filter(
    (s) => s.trackingCode && ['preparing', 'shipped'].includes(s.shipmentStatus)
  );
  if (activeShipments.length > 0) {
    const synced = await Promise.all(
      activeShipments.map((s) => syncSingleShipmentFromGHN(s).catch(() => null))
    );
    synced.forEach((updated) => {
      if (updated && updated._id) {
        const idx = shipments.findIndex((s) => String(s._id) === String(updated._id));
        if (idx !== -1) {
          shipments[idx] = updated.toObject ? updated.toObject() : updated;
        }
      }
    });
  }

  const detailsByOrder = {};
  for (const d of details) {
    const oid = String(d.salesOrderId);
    if (!detailsByOrder[oid]) detailsByOrder[oid] = [];
    detailsByOrder[oid].push(d);
  }

  const shipmentsByOrder = {};
  for (const s of shipments) {
    const oid = String(s.orderId);
    if (!shipmentsByOrder[oid]) shipmentsByOrder[oid] = [];
    shipmentsByOrder[oid].push(s);
  }

  return orders.map((o) => {
    const ordShipments = shipmentsByOrder[String(o._id)] || [];
    return {
      ...o,
      items: detailsByOrder[String(o._id)] || [],
      shipments: ordShipments,
      shipment: resolvePrimaryShipment(ordShipments),
    };
  });
};

