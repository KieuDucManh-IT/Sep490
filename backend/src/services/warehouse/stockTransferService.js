import mongoose from 'mongoose';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Shop } from '../../models/shop/Shop.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
import { StockTransferDetail } from '../../models/warehouse/transfer/StockTransferDetail.js';
import User from '../../models/system/User.js';
import { increaseInventoryBalance, recordStockMovement } from './inventoryLedgerService.js';
import {
  validateCreateTransferRequest,
  validateTransferDecision,
  validateTransferPick,
  validateTransferReceipt,
} from '../../validations/warehouse/stockTransferValidation.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const roleOf = (user) => String(user?.Role || '').toLowerCase();
const isManager = (user) => ['warehouse_manager', 'admin'].includes(roleOf(user));
const isBranchManager = (user) => ['branch_manager', 'admin'].includes(roleOf(user));
const validId = (id) => mongoose.isValidObjectId(id);
const makeCode = () => `DC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;

const transferPopulation = [
  { path: 'fromLocationId', select: 'code name type' },
  { path: 'toLocationId', select: 'code name type shopId', populate: { path: 'shopId', select: 'name managerId' } },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'assignedStaffId', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
  { path: 'shippedBy', select: 'FullName Email' },
  { path: 'receivedBy', select: 'FullName Email' },
];

const loadDetails = (transferId) => StockTransferDetail.find({ transferId }).sort({ createdAt: 1 })
  .populate({ path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'productCode name trackingType' } })
  .populate('fromStorageId', 'code name type')
  .populate('itemIds', 'itemCode serialNumber condition status');

const getCentralWarehouse = async () => {
  const locations = await InventoryLocation.find({ type: 'warehouse', status: 'active' }).select('_id code name maxCapacity').lean();
  if (locations.length !== 1) throw fail('Hệ thống cần cấu hình đúng một kho tổng đang hoạt động trước khi điều chuyển hàng.', 409);
  return locations[0];
};

const getBranchShops = async (user) => {
  if (!isBranchManager(user)) throw fail('Chỉ quản lý chi nhánh mới có thể tạo yêu cầu bổ sung hàng.', 403);
  return Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).select('_id name isHQ').sort({ isHQ: -1, name: 1 }).lean();
};

const getShopInventoryLocation = async (shopId) => {
  const locations = await InventoryLocation.find({ shopId, type: 'store', status: 'active' }).select('_id shopId code name').lean();
  if (locations.length !== 1) throw fail(locations.length ? 'Chi nhánh phải có đúng một kho cửa hàng đang hoạt động.' : 'Chi nhánh chưa được cấu hình kho cửa hàng.', 409);
  return locations[0];
};

export const getBranchTransferContext = async (user, activeBranchId = '') => {
  const shops = await getBranchShops(user);
  const locations = shops.length ? await InventoryLocation.find({ shopId: { $in: shops.map((shop) => shop._id) }, type: 'store', status: 'active' }).select('_id shopId code name').lean() : [];
  const locationByShop = new Map(locations.map((location) => [String(location.shopId), location]));
  const branches = shops.map((shop) => ({ ...shop, inventoryLocation: locationByShop.get(String(shop._id)) || null }));
  const selectedBranch = branches.find((shop) => String(shop._id) === String(activeBranchId) && shop.inventoryLocation)
    || (branches.length === 1 && branches[0].inventoryLocation ? branches[0] : branches.find((shop) => shop.inventoryLocation) || null);
  return {
    branches,
    selectedBranch,
    centralWarehouse: await getCentralWarehouse(),
  };
};

const assertBranchOwnsLocation = async (locationId, user) => {
  if (!isBranchManager(user)) throw fail('Bạn không có quyền tạo hoặc nhận yêu cầu điều chuyển.', 403);
  const location = await InventoryLocation.findOne({ _id: locationId, type: 'store', status: 'active' }).populate('shopId', 'managerId status isDeleted name').lean();
  if (!location || !location.shopId || location.shopId.status !== 'ACTIVE' || location.shopId.isDeleted || String(location.shopId.managerId) !== String(user._id)) {
    throw fail('Kho chi nhánh không tồn tại, không hoạt động hoặc không thuộc chi nhánh bạn quản lý.', 403);
  }
  return location;
};

const canAccessTransfer = async (transfer, user) => {
  if (isManager(user)) return;
  if (roleOf(user) === 'warehouse_staff' && String(transfer.assignedStaffId?._id || transfer.assignedStaffId) === String(user._id)) return;
  await assertBranchOwnsLocation(transfer.toLocationId, user);
};

const getTransfer = async (transferId, user = null) => {
  if (!validId(transferId)) throw fail('Mã phiếu điều chuyển không hợp lệ.');
  const transfer = await StockTransfer.findOne({ _id: transferId, direction: { $ne: 'branch_to_central' } }).populate(transferPopulation);
  if (!transfer) throw fail('Không tìm thấy yêu cầu điều chuyển.', 404);
  if (user) await canAccessTransfer(transfer, user);
  return { ...transfer.toObject(), items: await loadDetails(transferId) };
};

export const listStockTransfers = async (user, { status = '' } = {}) => {
  const filter = { direction: { $ne: 'branch_to_central' } };
  if (status && ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'partially_received', 'received', 'cancelled'].includes(status)) filter.status = status;
  if (roleOf(user) === 'warehouse_staff') {
    filter.assignedStaffId = user._id;
  } else if (!isManager(user)) {
    if (!isBranchManager(user)) throw fail('Bạn không có quyền xem phiếu điều chuyển.', 403);
    const shopIds = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).distinct('_id');
    const locationIds = await InventoryLocation.find({ shopId: { $in: shopIds }, type: 'store' }).distinct('_id');
    filter.toLocationId = { $in: locationIds };
  }
  const transfers = await StockTransfer.find(filter).sort({ createdAt: -1 }).populate(transferPopulation);
  return Promise.all(transfers.map(async (transfer) => ({ ...transfer.toObject(), items: await loadDetails(transfer._id) })));
};

export const listWarehouseTransferStaff = () => User.find({ Role: /^warehouse_staff$/i, Status: /^active$/i }).select('FullName Email').sort({ FullName: 1 }).lean();

export const createTransferRequest = async (payload, user) => {
  if (!isBranchManager(user)) throw fail('Chỉ quản lý chi nhánh mới có thể tạo yêu cầu bổ sung hàng.', 403);
  const data = validateCreateTransferRequest(payload);
  const shops = await getBranchShops(user);
  const shop = data.branchId
    ? shops.find((row) => String(row._id) === data.branchId)
    : shops.length === 1 ? shops[0] : null;
  if (!shop) throw fail('Không xác định được chi nhánh đang thao tác. Hãy chọn chi nhánh trong thanh điều hướng rồi thử lại.', 409);
  const [central, branch, variants] = await Promise.all([
    getCentralWarehouse(),
    getShopInventoryLocation(shop._id),
    ProductVariant.find({ _id: { $in: data.items.map((item) => item.variantId) }, status: 'active' }).populate('productId', 'status').lean(),
  ]);
  if (variants.length !== data.items.length || variants.some((variant) => !variant.productId || variant.productId.status !== 'active')) throw fail('Có biến thể không tồn tại hoặc đã ngừng kinh doanh.');
  const session = await mongoose.startSession();
  let transferId;
  try {
    await session.withTransaction(async () => {
      const [transfer] = await StockTransfer.create([{
        transferCode: makeCode(), fromLocationId: central._id, toLocationId: branch._id,
        createdBy: user._id, status: 'requested', note: data.note,
      }], { session });
      transferId = transfer._id;
      await StockTransferDetail.insertMany(data.items.map((item) => ({ transferId, ...item })), { session });
    });
  } finally { await session.endSession(); }
  return getTransfer(transferId, user);
};

export const getStockTransfer = getTransfer;

export const decideTransferRequest = async (transferId, payload, user) => {
  if (!isManager(user)) throw fail('Chỉ quản lý kho tổng mới được duyệt yêu cầu điều chuyển.', 403);
  const decision = validateTransferDecision(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: transferId, direction: { $ne: 'branch_to_central' }, status: 'requested' }).session(session);
      if (!transfer) throw fail('Yêu cầu không còn ở trạng thái chờ duyệt.', 409);
      if (decision.decision === 'reject') {
        transfer.status = 'rejected';
        transfer.approvedBy = user._id;
        transfer.approvedAt = new Date();
        if (decision.note) transfer.note = `${transfer.note || ''}\nTừ chối: ${decision.note}`.trim();
        await transfer.save({ session });
        return;
      }
      const details = await StockTransferDetail.find({ transferId }).session(session);
      const staff = await User.findOne({ _id: decision.assignedStaffId, Role: /^warehouse_staff$/i, Status: /^active$/i }).session(session);
      if (!staff) throw fail('Nhân viên kho được giao không tồn tại hoặc đã ngừng hoạt động.', 400);
      const byId = new Map(details.map((detail) => [String(detail._id), detail]));
      if (decision.items.length !== details.length || decision.items.some((item) => !byId.has(item.detailId))) throw fail('Cần duyệt đầy đủ các dòng trong yêu cầu.');
      let anyApproved = false;
      for (const line of decision.items) {
        const detail = byId.get(line.detailId);
        if (line.quantityApproved > detail.quantityRequested) throw fail('Số lượng duyệt không được lớn hơn số lượng chi nhánh yêu cầu.');
        if (line.quantityApproved > 0) {
          const variant = await ProductVariant.findById(detail.variantId).select('productId').populate('productId', 'trackingType').session(session).lean();
          if (variant?.productId?.trackingType === 'individual') {
            const available = await InventoryItem.countDocuments({ locationId: transfer.fromLocationId, variantId: detail.variantId, status: 'available' }).session(session);
            if (available < line.quantityApproved) throw fail(`Kho tổng chỉ còn ${available} cá thể khả dụng cho biến thể này.`, 409);
          } else {
            const balances = await InventoryBalance.find({ locationId: transfer.fromLocationId, variantId: detail.variantId }).session(session);
            const available = balances.reduce((sum, row) => sum + row.quantityOnHand - row.quantityReserved - row.quantityUnavailable, 0);
            if (available < line.quantityApproved) throw fail(`Kho tổng chỉ còn ${Math.max(0, available)} cái khả dụng cho biến thể này.`, 409);
          }
        }
        detail.quantityApproved = line.quantityApproved;
        detail.pickAllocations = [];
        if (line.quantityApproved > 0) anyApproved = true;
        await detail.save({ session });
      }
      if (!anyApproved) throw fail('Cần duyệt số lượng lớn hơn 0 cho ít nhất một mặt hàng.');
      transfer.status = 'approved';
      transfer.assignedStaffId = decision.assignedStaffId;
      transfer.approvedBy = user._id;
      transfer.approvedAt = new Date();
      if (decision.note) transfer.note = `${transfer.note || ''}\nDuyệt: ${decision.note}`.trim();
      await transfer.save({ session });
    });
  } finally { await session.endSession(); }
  return getTransfer(transferId, user);
};

export const getTransferPickCandidates = async (transferId, detailId, storageId, user) => {
  if (!['warehouse_staff', 'warehouse_manager', 'admin'].includes(roleOf(user))) throw fail('Bạn không có quyền soạn hàng.', 403);
  const transfer = await StockTransfer.findOne({ _id: transferId, direction: { $ne: 'branch_to_central' } });
  if (!transfer) throw fail('Không tìm thấy phiếu điều chuyển.', 404);
  if (roleOf(user) === 'warehouse_staff' && String(transfer.assignedStaffId) !== String(user._id)) throw fail('Phiếu này chưa được giao cho bạn.', 403);
  if (transfer.status !== 'approved') throw fail('Phiếu chưa ở trạng thái chờ soạn hàng.', 409);
  const detail = await StockTransferDetail.findOne({ _id: detailId, transferId });
  if (!detail) throw fail('Không tìm thấy dòng hàng.', 404);
  const storage = storageId && storageId !== 'none' ? storageId : null;
  if (storage && !await StorageLocation.exists({ _id: storage, locationId: transfer.fromLocationId, status: 'active' })) throw fail('Vị trí không thuộc kho tổng hoặc đã ngừng hoạt động.');
  const variant = await ProductVariant.findById(detail.variantId).select('productId').populate('productId', 'trackingType').lean();
  if (variant?.productId?.trackingType === 'individual') return InventoryItem.find({ locationId: transfer.fromLocationId, storageId: storage, variantId: detail.variantId, status: 'available' }).select('_id itemCode serialNumber condition status').sort({ createdAt: 1 }).lean();
  const balance = await InventoryBalance.findOne({ locationId: transfer.fromLocationId, storageId: storage, variantId: detail.variantId }).select('quantityOnHand quantityReserved quantityUnavailable').lean();
  return { available: Math.max(0, (balance?.quantityOnHand || 0) - (balance?.quantityReserved || 0) - (balance?.quantityUnavailable || 0)) };
};

export const saveTransferPick = async (transferId, payload, user) => {
  if (!['warehouse_staff', 'warehouse_manager', 'admin'].includes(roleOf(user))) throw fail('Bạn không có quyền soạn hàng.', 403);
  const data = validateTransferPick(payload);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const transfer = await StockTransfer.findOne({ _id: transferId, direction: { $ne: 'branch_to_central' }, status: 'approved' }).session(session);
    if (!transfer) throw fail('Phiếu chưa ở trạng thái chờ soạn hàng.', 409);
    if (roleOf(user) === 'warehouse_staff' && String(transfer.assignedStaffId) !== String(user._id)) throw fail('Phiếu này chưa được giao cho bạn.', 403);
    const details = await StockTransferDetail.find({ transferId }).session(session);
    const byId = new Map(details.map((line) => [String(line._id), line]));
    if (data.items.length !== details.filter((line) => line.quantityApproved > 0).length || data.items.some((line) => !byId.has(line.detailId))) throw fail('Phân bổ đầy đủ các dòng hàng đã duyệt.');
    for (const line of data.items) {
      const detail = byId.get(line.detailId);
      if (line.allocations.reduce((sum, row) => sum + row.quantity, 0) !== detail.quantityApproved) throw fail('Tổng số lượng các vị trí phải bằng số lượng được duyệt.');
      const variant = await ProductVariant.findById(detail.variantId).select('productId').populate('productId', 'trackingType').session(session).lean();
      const individual = variant?.productId?.trackingType === 'individual';
      for (const allocation of line.allocations) {
        if (allocation.storageId && !await StorageLocation.exists({ _id: allocation.storageId, locationId: transfer.fromLocationId, status: 'active' }).session(session)) throw fail('Vị trí xuất không thuộc kho tổng hoặc đã ngừng hoạt động.');
        if (individual) {
          if (allocation.itemIds.length !== allocation.quantity) throw fail('Chọn đúng số InventoryItem cho từng vị trí.');
          const count = await InventoryItem.countDocuments({ _id: { $in: allocation.itemIds }, locationId: transfer.fromLocationId, storageId: allocation.storageId, variantId: detail.variantId, status: 'available' }).session(session);
          if (count !== allocation.quantity) throw fail('Một số InventoryItem đã thay đổi vị trí hoặc trạng thái.', 409);
        } else {
          if (allocation.itemIds.length) throw fail('Mặt hàng quản lý theo số lượng không cần chọn InventoryItem.');
          const balance = await InventoryBalance.findOne({ locationId: transfer.fromLocationId, storageId: allocation.storageId, variantId: detail.variantId }).session(session);
          const available = (balance?.quantityOnHand || 0) - (balance?.quantityReserved || 0) - (balance?.quantityUnavailable || 0);
          if (available < allocation.quantity) throw fail(`Vị trí chỉ còn ${Math.max(0, available)} cái khả dụng.`, 409);
        }
      }
      detail.pickAllocations = line.allocations;
      await detail.save({ session });
    }
    transfer.status = 'preparing';
    await transfer.save({ session });
  }); } finally { await session.endSession(); }
  return getTransfer(transferId, user);
};

export const shipTransfer = async (transferId, user) => {
  if (!['warehouse_staff', 'warehouse_manager', 'admin'].includes(roleOf(user))) throw fail('Bạn không có quyền xác nhận xuất hàng.', 403);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: transferId, direction: { $ne: 'branch_to_central' }, status: 'preparing' }).session(session);
      if (!transfer) throw fail('Phiếu chưa được phân bổ vị trí hoặc đã xuất hàng.', 409);
      if (roleOf(user) === 'warehouse_staff' && String(transfer.assignedStaffId) !== String(user._id)) throw fail('Phiếu này chưa được giao cho bạn.', 403);
      const details = await StockTransferDetail.find({ transferId }).session(session);
      const variantRows = await ProductVariant.find({ _id: { $in: details.map((detail) => detail.variantId) } }).select('productId').populate('productId', 'trackingType').session(session).lean();
      const tracking = new Map(variantRows.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
      for (const detail of details) {
        const quantity = detail.quantityApproved || 0;
        if (!quantity) continue;
        const allocations = detail.pickAllocations || [];
        if (allocations.reduce((sum, allocation) => sum + allocation.quantity, 0) !== quantity) throw fail('Phân bổ vị trí không khớp số lượng được duyệt.', 409);
        const individual = tracking.get(String(detail.variantId)) === 'individual';
        const itemIds = [];
        for (const allocation of allocations) {
          const storageId = allocation.storageId || null;
          if (individual) {
            const items = await InventoryItem.find({ _id: { $in: allocation.itemIds }, locationId: transfer.fromLocationId, storageId, variantId: detail.variantId, status: 'available' }).session(session);
            if (items.length !== allocation.quantity) throw fail('Một số InventoryItem đã thay đổi vị trí hoặc trạng thái.', 409);
            for (const item of items) {
              itemIds.push(item._id);
              item.status = 'in_transit';
              await item.save({ session });
              await recordStockMovement({ variantId: detail.variantId, itemId: item._id, locationId: transfer.fromLocationId, storageId, movementType: 'transfer_out', quantityChange: -1, referenceType: 'stock_transfer', referenceId: transfer._id, createdBy: user._id }, session);
            }
          } else {
            const balance = await InventoryBalance.findOne({ locationId: transfer.fromLocationId, storageId, variantId: detail.variantId }).session(session);
            const available = (balance?.quantityOnHand || 0) - (balance?.quantityReserved || 0) - (balance?.quantityUnavailable || 0);
            if (!balance || available < allocation.quantity) throw fail('Tồn khả dụng tại một vị trí đã thay đổi.', 409);
            balance.quantityOnHand -= allocation.quantity;
            await balance.save({ session });
            await recordStockMovement({ variantId: detail.variantId, locationId: transfer.fromLocationId, storageId, movementType: 'transfer_out', quantityChange: -allocation.quantity, referenceType: 'stock_transfer', referenceId: transfer._id, createdBy: user._id }, session);
          }
        }
        detail.itemIds = itemIds;
        detail.quantityShipped = quantity;
        await detail.save({ session });
      }
      transfer.status = 'shipped';
      transfer.shippedBy = user._id;
      transfer.shippedAt = new Date();
      await transfer.save({ session });
    });
  } finally { await session.endSession(); }
  return getTransfer(transferId, user);
};
const assertBranchCapacity = async (location, incoming, session) => {
  if (location.maxCapacity == null) return;
  const [balances, individualItems] = await Promise.all([
    InventoryBalance.find({ locationId: location._id }).select('variantId quantityOnHand').session(session).lean(),
    InventoryItem.find({ locationId: location._id, status: { $nin: ['disposed', 'renting', 'in_transit'] } }).select('variantId').session(session).lean(),
  ]);
  const variants = await ProductVariant.find({ _id: { $in: [...balances.map((row) => row.variantId), ...individualItems.map((row) => row.variantId), ...incoming.map((row) => row.variantId)] } })
    .select('productId').populate('productId', 'trackingType').session(session).lean();
  const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
  const current = balances.reduce((sum, row) => sum + (tracking.get(String(row.variantId)) === 'individual' ? 0 : row.quantityOnHand), 0)
    + individualItems.reduce((sum, row) => sum + (tracking.get(String(row.variantId)) === 'individual' ? 1 : 0), 0);
  const added = incoming.reduce((sum, row) => sum + row.quantity, 0);
  if (current + added > location.maxCapacity) throw fail(`Kho chi nhánh không đủ sức chứa. Còn ${Math.max(0, location.maxCapacity - current)} cái.`, 409);
};

export const receiveTransfer = async (transferId, payload, user) => {
  if (!isBranchManager(user)) throw fail('Chỉ quản lý chi nhánh mới được xác nhận nhận hàng.', 403);
  const receipt = validateTransferReceipt(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: transferId, direction: { $ne: 'branch_to_central' }, status: { $in: ['shipped', 'partially_received'] } }).session(session);
      if (!transfer) throw fail('Phiếu chưa được xuất từ kho tổng hoặc đã hoàn tất nhận hàng.', 409);
      const destination = await assertBranchOwnsLocation(transfer.toLocationId, user);
      const details = await StockTransferDetail.find({ transferId }).session(session);
      const detailById = new Map(details.map((detail) => [String(detail._id), detail]));
      if (receipt.items.length !== details.length || receipt.items.some((line) => !detailById.has(line.detailId))) throw fail('Cần xác nhận đầy đủ các dòng hàng trong phiếu.');
      const variants = await ProductVariant.find({ _id: { $in: details.map((detail) => detail.variantId) } }).select('productId').populate('productId', 'trackingType').session(session).lean();
      const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
      const incoming = receipt.items.map((line) => {
        const detail = detailById.get(line.detailId);
        return { variantId: detail.variantId, quantity: Math.max(0, line.quantityReceived - detail.quantityReceived) };
      }).filter((line) => line.quantity > 0);
      await assertBranchCapacity(destination, incoming, session);
      for (const line of receipt.items) {
        const detail = detailById.get(line.detailId);
        if (line.quantityReceived < detail.quantityReceived || line.quantityReceived > detail.quantityShipped) throw fail('Số lượng nhận phải từ số đã nhận trước đó đến số lượng đã xuất.');
        if (line.quantityDamaged < detail.quantityDamaged || line.quantityDamaged > line.quantityReceived) throw fail('Số lượng hỏng không hợp lệ.');
        const individual = tracking.get(String(detail.variantId)) === 'individual';
        const previousReceived = new Set((detail.receivedItemIds || []).map(String));
        if (individual) {
          const shippedIds = new Set(detail.itemIds.map(String));
          const receivedIds = new Set(line.receivedItemIds);
          const damagedIds = new Set(line.damagedItemIds);
          if (receivedIds.size !== line.quantityReceived || [...receivedIds].some((id) => !shippedIds.has(id))) throw fail('Danh sách mã cá thể nhận không khớp số lượng hoặc phiếu xuất.');
          if (damagedIds.size !== line.quantityDamaged || [...damagedIds].some((id) => !receivedIds.has(id))) throw fail('Danh sách mã cá thể hỏng không hợp lệ.');
          if ([...previousReceived].some((id) => !receivedIds.has(id))) throw fail('Không thể bỏ mã hàng đã xác nhận nhận ở lần trước.');
        } else if (line.receivedItemIds.length || line.damagedItemIds.length) throw fail('Không gửi mã cá thể cho biến thể quản lý theo số lượng.');
        const receivedDelta = line.quantityReceived - detail.quantityReceived;
        const damagedDelta = line.quantityDamaged - detail.quantityDamaged;
        const previousDamaged = new Set((detail.damagedItemIds || []).map(String));
        if (individual && [...previousDamaged].some((id) => !line.damagedItemIds.includes(id))) throw fail('Không thể bỏ trạng thái hỏng đã ghi nhận ở lần trước.');
        detail.quantityReceived = line.quantityReceived;
        detail.quantityDamaged = line.quantityDamaged;
        detail.quantityMissing = receipt.complete ? detail.quantityShipped - line.quantityReceived : 0;
        if (individual) {
          detail.receivedItemIds = line.receivedItemIds;
          detail.damagedItemIds = line.damagedItemIds;
        }
        await detail.save({ session });
        if (individual) {
          for (const itemId of line.receivedItemIds) {
            const isDamaged = line.damagedItemIds.includes(itemId);
            const item = previousReceived.has(itemId)
              ? await InventoryItem.findOne({ _id: itemId, locationId: destination._id }).session(session)
              : await InventoryItem.findOne({ _id: itemId, locationId: transfer.fromLocationId, status: 'in_transit' }).session(session);
            if (!item) throw fail('Một mã hàng cá thể không còn ở trạng thái/vị trí dự kiến.', 409);
            if (!previousReceived.has(itemId)) {
              item.locationId = destination._id;
              item.storageId = null;
            }
            item.status = isDamaged ? 'unavailable' : 'available';
            if (isDamaged) item.condition = 'damaged';
            await item.save({ session });
            if (!previousReceived.has(itemId)) {
              await recordStockMovement({
                variantId: detail.variantId, itemId: item._id, locationId: destination._id,
                movementType: 'transfer_in', quantityChange: 1, referenceType: 'stock_transfer',
                referenceId: transfer._id, createdBy: user._id,
              }, session);
            }
          }
          if (receipt.complete) {
            const received = new Set(line.receivedItemIds);
            const missingIds = detail.itemIds.map(String).filter((id) => !received.has(id));
            if (missingIds.length) await InventoryItem.updateMany({ _id: { $in: missingIds }, status: 'in_transit' }, { $set: { status: 'disposed' } }, { session });
          }
        } else {
          if (receivedDelta > 0 || damagedDelta > 0) {
            const balance = await increaseInventoryBalance({
              locationId: destination._id, storageId: null, variantId: detail.variantId,
              quantity: receivedDelta, increments: { quantityUnavailable: damagedDelta }, session,
            });
            if (balance.quantityOnHand < balance.quantityReserved + balance.quantityUnavailable) throw fail('Số lượng khả dụng của chi nhánh không thể âm.', 409);
            await recordStockMovement({
              variantId: detail.variantId, locationId: destination._id, storageId: null,
              movementType: 'transfer_in', quantityChange: receivedDelta,
              referenceType: 'stock_transfer', referenceId: transfer._id, createdBy: user._id,
            }, session);
          }
        }
      }
      if (receipt.complete) {
        transfer.status = 'received';
        transfer.receivedBy = user._id;
        transfer.receivedAt = new Date();
      } else {
        transfer.status = 'partially_received';
      }
      if (receipt.note) transfer.note = `${transfer.note || ''}\nNhận hàng: ${receipt.note}`.trim();
      await transfer.save({ session });
    });
  } finally { await session.endSession(); }
  return getTransfer(transferId, user);
};
