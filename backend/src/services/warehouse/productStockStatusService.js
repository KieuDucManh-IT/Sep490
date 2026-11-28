
import mongoose from 'mongoose';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Product } from '../../models/masterdata/Product.js';

/** Tính số lượng khả dụng = max(0, onHand − reserved − unavailable). */
const availableOf = (row) =>
  Math.max(0, (row.quantityOnHand || 0) - (row.quantityReserved || 0) - (row.quantityUnavailable || 0));

/**
 * Lấy danh sách locationId của tất cả chi nhánh đang hoạt động (type: store, status: active).
 * Dùng cache trong 5 giây để tránh query lặp nhiều lần trong cùng request.
 */
let _storeLocationCache = null;
let _storeLocationCacheAt = 0;
const CACHE_TTL_MS = 5000;

const getActiveStoreLocationIds = async (session = null) => {
  const now = Date.now();
  if (!session && _storeLocationCache && now - _storeLocationCacheAt < CACHE_TTL_MS) {
    return _storeLocationCache;
  }
  const query = InventoryLocation.find({ type: 'store', status: 'active', isDeleted: { $ne: true } })
    .select('_id');
  if (session) query.session(session);
  const locations = await query.lean();
  const ids = locations.map((l) => l._id);
  if (!session) {
    _storeLocationCache = ids;
    _storeLocationCacheAt = now;
  }
  return ids;
};

/** Xóa cache khi cần (ví dụ sau khi thêm/xóa chi nhánh). */
export const clearStoreLocationCache = () => {
  _storeLocationCache = null;
  _storeLocationCacheAt = 0;
};

/**
 * Kiểm tra và cập nhật trạng thái hết hàng (isOutOfStock) cho một hoặc nhiều product.
 *
 * @param {string|string[]} productIds  - ObjectId (string hoặc mongoose) của sản phẩm cần kiểm tra.
 * @param {object}          session     - Mongoose session (tùy chọn, dùng khi gọi trong transaction).
 *
 * Hàm tính tổng quantityAvailable của tất cả biến thể thuộc product tại tất cả chi nhánh đang hoạt động.
 * Nếu total = 0 → isOutOfStock = true; nếu > 0 → isOutOfStock = false.
 */
export const refreshOutOfStockStatus = async (productIds, session = null) => {
  try {
    const ids = (Array.isArray(productIds) ? productIds : [productIds])
      .map((id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : null))
      .filter(Boolean);

    if (!ids.length) return;

    // Lấy tất cả biến thể còn active của các product này
    const variantQuery = ProductVariant.find({
      productId: { $in: ids },
      isDeleted: { $ne: true },
      status: { $ne: 'inactive' },
    }).select('_id productId');
    if (session) variantQuery.session(session);
    const variants = await variantQuery.lean();

    if (!variants.length) {
      // Không có biến thể nào → coi như hết hàng
      await Product.updateMany(
        { _id: { $in: ids } },
        { $set: { isOutOfStock: true, outOfStockAt: new Date() } },
        ...(session ? [{ session }] : []),
      );
      return;
    }

    const variantIds = variants.map((v) => v._id);
    // Map variantId → productId (string)
    const productByVariant = new Map(variants.map((v) => [String(v._id), String(v.productId)]));

    // Lấy locationId các chi nhánh đang hoạt động
    const storeLocationIds = await getActiveStoreLocationIds(session);

    // Tổng hợp tồn kho của các biến thể tại các chi nhánh
    const balanceQuery = InventoryBalance.find({
      variantId: { $in: variantIds },
      locationId: { $in: storeLocationIds.length ? storeLocationIds : [new mongoose.Types.ObjectId()] }, // rỗng → không có chi nhánh nào
    }).select('variantId quantityOnHand quantityReserved quantityUnavailable');
    if (session) balanceQuery.session(session);
    const balances = await balanceQuery.lean();

    // Tính tổng available theo productId
    const availableByProduct = new Map(ids.map((id) => [String(id), 0]));
    for (const row of balances) {
      const pid = productByVariant.get(String(row.variantId));
      if (!pid || !availableByProduct.has(pid)) continue;
      availableByProduct.set(pid, availableByProduct.get(pid) + availableOf(row));
    }

    // Lấy thông tin restockRequestedAt của các sản phẩm đang xét
    const productsInScope = await Product.find({ _id: { $in: ids } })
      .select('_id restockRequestedAt')
      .lean();
    const restockPendingMap = new Map(productsInScope.map((p) => [String(p._id), Boolean(p.restockRequestedAt)]));

    // Phân thành 2 nhóm: hết hàng & còn hàng
    const outOfStockIds = [];
    const inStockIds = [];
    for (const [pid, total] of availableByProduct.entries()) {
      if (total === 0) {
        // Chỉ đánh dấu hết hàng nếu KHÔNG có yêu cầu nhập hàng đang chờ từ Branch Manager
        if (!restockPendingMap.get(pid)) {
          outOfStockIds.push(pid);
        }
      } else {
        inStockIds.push(pid);
      }
    }

    const now = new Date();
    const opts = session ? [{ session }] : [];

    if (outOfStockIds.length) {
      await Product.updateMany(
        { _id: { $in: outOfStockIds }, isOutOfStock: { $ne: true } },
        { $set: { isOutOfStock: true, outOfStockAt: now } },
        ...opts,
      );
      console.info(`[TASK-012] Đánh dấu hết hàng: ${outOfStockIds.length} sản phẩm`, outOfStockIds);
    }

    if (inStockIds.length) {
      await Product.updateMany(
        { _id: { $in: inStockIds }, $or: [{ isOutOfStock: true }, { restockRequestedAt: { $ne: null } }] },
        { $set: { isOutOfStock: false, outOfStockAt: null, restockRequestedAt: null } },
        ...opts,
      );
    }
  } catch (err) {
    // Không để lỗi phụ ảnh hưởng luồng chính (putaway, return, v.v.)
    console.error('[TASK-012] refreshOutOfStockStatus lỗi:', err.message);
  }
};

/**
 * Reset isOutOfStock = false cho các product có biến thể trong danh sách variantIds.
 * Gọi khi branch_manager/warehouse_manager tạo phiếu nhập hàng.
 * Sản phẩm sẽ hiện lại với customer ngay lập tức (hàng sắp về).
 *
 * @param {string[]} variantIds  - Danh sách variantId trong phiếu nhập.
 * @param {object}   session     - Mongoose session (tùy chọn).
 */
export const markRestockRequested = async (variantIds, session = null) => {
  try {
    if (!variantIds?.length) return;

    const validVariantIds = variantIds
      .map((id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : null))
      .filter(Boolean);
    if (!validVariantIds.length) return;

    // Tìm productId của các biến thể này
    const variantQuery = ProductVariant.find({ _id: { $in: validVariantIds } }).select('productId');
    if (session) variantQuery.session(session);
    const variants = await variantQuery.lean();

    const productIds = [...new Set(variants.map((v) => String(v.productId)))];
    if (!productIds.length) return;

    const now = new Date();
    const opts = session ? [{ session }] : [];

    // Chỉ reset những sản phẩm đang bị đánh dấu hết hàng
    const result = await Product.updateMany(
      { _id: { $in: productIds }, isOutOfStock: true },
      { $set: { isOutOfStock: false, outOfStockAt: null, restockRequestedAt: now } },
      ...opts,
    );

    if (result.modifiedCount > 0) {
      console.info(`[TASK-012] Hiển thị lại ${result.modifiedCount} sản phẩm do phiếu nhập mới.`);
    }
  } catch (err) {
    console.error('[TASK-012] markRestockRequested lỗi:', err.message);
  }
};
