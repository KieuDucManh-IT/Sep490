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
  if (locations.length !== 1) throw fail('Há»‡ thá»‘ng cáº§n cáº¥u hÃ¬nh Ä‘Ãºng má»™t kho tá»•ng Ä‘ang hoáº¡t Ä‘á»™ng trÆ°á»›c khi Ä‘iá»u chuyá»ƒn hÃ ng.', 409);
  return locations[0];
};

const getBranchShops = async (user) => {
  if (!isBranchManager(user)) throw fail('Chá»‰ quáº£n lÃ½ chi nhÃ¡nh má»›i cÃ³ thá»ƒ táº¡o yÃªu cáº§u bá»• sung hÃ ng.', 403);
  return Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).select('_id name isHQ').sort({ isHQ: -1, name: 1 }).lean();
};

const getShopInventoryLocation = async (shopId) => {
  const locations = await InventoryLocation.find({ shopId, type: 'store', status: 'active' }).select('_id shopId code name').lean();
  if (locations.length !== 1) throw fail(locations.length ? 'Chi nhÃ¡nh pháº£i cÃ³ Ä‘Ãºng má»™t kho cá»­a hÃ ng Ä‘ang hoáº¡t Ä‘á»™ng.' : 'Chi nhÃ¡nh chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh kho cá»­a hÃ ng.', 409);
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
  if (!isBranchManager(user)) throw fail('Báº¡n khÃ´ng cÃ³ quyá»n táº¡o hoáº·c nháº­n yÃªu cáº§u Ä‘iá»u chuyá»ƒn.', 403);
  const location = await InventoryLocation.findOne({ _id: locationId, type: 'store', status: 'active' }).populate('shopId', 'managerId status isDeleted name').lean();
  if (!location || !location.shopId || location.shopId.status !== 'ACTIVE' || location.shopId.isDeleted || String(location.shopId.managerId) !== String(user._id)) {
    throw fail('Kho chi nhÃ¡nh khÃ´ng tá»“n táº¡i, khÃ´ng hoáº¡t Ä‘á»™ng hoáº·c khÃ´ng thuá»™c chi nhÃ¡nh báº¡n quáº£n lÃ½.', 403);
  }
  return location;
};

const canAccessTransfer = async (transfer, user) => {
  if (isManager(user)) return;
  if (roleOf(user) === 'warehouse_staff' && String(transfer.assignedStaffId?._id || transfer.assignedStaffId) === String(user._id)) return;
  await assertBranchOwnsLocation(transfer.toLocationId, user);
};

const getTransfer = async (transferId, user = null) => {
  if (!validId(transferId)) throw fail('MÃ£ phiáº¿u Ä‘iá»u chuyá»ƒn khÃ´ng há»£p lá»‡.');
  const transfer = await StockTransfer.findById(transferId).populate(transferPopulation);
  if (!transfer) throw fail('KhÃ´ng tÃ¬m tháº¥y yÃªu cáº§u Ä‘iá»u chuyá»ƒn.', 404);
  if (user) await canAccessTransfer(transfer, user);
  return { ...transfer.toObject(), items: await loadDetails(transferId) };
};

export const listStockTransfers = async (user, { status = '' } = {}) => {
  const filter = {};
  if (status && ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'partially_received', 'received', 'cancelled'].includes(status)) filter.status = status;
  if (roleOf(user) === 'warehouse_staff') {
    filter.assignedStaffId = user._id;
  } else if (!isManager(user)) {
    if (!isBranchManager(user)) throw fail('Báº¡n khÃ´ng cÃ³ quyá»n xem phiáº¿u Ä‘iá»u chuyá»ƒn.', 403);
    const shopIds = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).distinct('_id');
    const locationIds = await InventoryLocation.find({ shopId: { $in: shopIds }, type: 'store' }).distinct('_id');
    filter.toLocationId = { $in: locationIds };
  }
  const transfers = await StockTransfer.find(filter).sort({ createdAt: -1 }).populate(transferPopulation);
  return Promise.all(transfers.map(async (transfer) => ({ ...transfer.toObject(), items: await loadDetails(transfer._id) })));
};

export const listWarehouseTransferStaff = () => User.find({ Role: /^warehouse_staff$/i, Status: /^active$/i }).select('FullName Email').sort({ FullName: 1 }).lean();

export const createTransferRequest = async (payload, user) => {
  if (!isBranchManager(user)) throw fail('Chá»‰ quáº£n lÃ½ chi nhÃ¡nh má»›i cÃ³ thá»ƒ táº¡o yÃªu cáº§u bá»• sung hÃ ng.', 403);
  const data = validateCreateTransferRequest(payload);
  const shops = await getBranchShops(user);
  const shop = data.branchId
    ? shops.find((row) => String(row._id) === data.branchId)
    : shops.length === 1 ? shops[0] : null;
  if (!shop) throw fail('KhÃ´ng xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c chi nhÃ¡nh Ä‘ang thao tÃ¡c. HÃ£y chá»n chi nhÃ¡nh trong thanh Ä‘iá»u hÆ°á»›ng rá»“i thá»­ láº¡i.', 409);
  const [central, branch, variants] = await Promise.all([
    getCentralWarehouse(),
    getShopInventoryLocation(shop._id),
    ProductVariant.find({ _id: { $in: data.items.map((item) => item.variantId) }, status: 'active' }).populate('productId', 'status').lean(),
  ]);
  if (variants.length !== data.items.length || variants.some((variant) => !variant.productId || variant.productId.status !== 'active')) throw fail('CÃ³ biáº¿n thá»ƒ khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ ngá»«ng kinh doanh.');
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
  if (!isManager(user)) throw fail('Chá»‰ quáº£n lÃ½ kho tá»•ng má»›i Ä‘Æ°á»£c duyá»‡t yÃªu cáº§u Ä‘iá»u chuyá»ƒn.', 403);
  const decision = validateTransferDecision(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: transferId, status: 'requested' }).session(session);
      if (!transfer) throw fail('YÃªu cáº§u khÃ´ng cÃ²n á»Ÿ tráº¡ng thÃ¡i chá» duyá»‡t.', 409);
      if (decision.decision === 'reject') {
        transfer.status = 'rejected';
        transfer.approvedBy = user._id;
        transfer.approvedAt = new Date();
        if (decision.note) transfer.note = `${transfer.note || ''}\nTá»« chá»‘i: ${decision.note}`.trim();
        await transfer.save({ session });
        return;
      }
      const details = await StockTransferDetail.find({ transferId }).session(session);
      const staff = await User.findOne({ _id: decision.assignedStaffId, Role: /^warehouse_staff$/i, Status: /^active$/i }).session(session);
      if (!staff) throw fail('NhÃ¢n viÃªn kho Ä‘Æ°á»£c giao khÃ´ng tá»“n táº¡i hoáº·c Ä‘Ã£ ngá»«ng hoáº¡t Ä‘á»™ng.', 400);
      const byId = new Map(details.map((detail) => [String(detail._id), detail]));
      if (decision.items.length !== details.length || decision.items.some((item) => !byId.has(item.detailId))) throw fail('Cáº§n duyá»‡t Ä‘áº§y Ä‘á»§ cÃ¡c dÃ²ng trong yÃªu cáº§u.');
      let anyApproved = false;
      for (const line of decision.items) {
        const detail = byId.get(line.detailId);
        if (line.quantityApproved > detail.quantityRequested) throw fail('Sá»‘ lÆ°á»£ng duyá»‡t khÃ´ng Ä‘Æ°á»£c lá»›n hÆ¡n sá»‘ lÆ°á»£ng chi nhÃ¡nh yÃªu cáº§u.');
        if (line.quantityApproved > 0) {
          const variant = await ProductVariant.findById(detail.variantId).select('productId').populate('productId', 'trackingType').session(session).lean();
          if (variant?.productId?.trackingType === 'individual') {
            const available = await InventoryItem.countDocuments({ locationId: transfer.fromLocationId, variantId: detail.variantId, status: 'available' }).session(session);
            if (available < line.quantityApproved) throw fail(`Kho tá»•ng chá»‰ cÃ²n ${available} cÃ¡ thá»ƒ kháº£ dá»¥ng cho biáº¿n thá»ƒ nÃ y.`, 409);
          } else {
            const balances = await InventoryBalance.find({ locationId: transfer.fromLocationId, variantId: detail.variantId }).session(session);
            const available = balances.reduce((sum, row) => sum + row.quantityOnHand - row.quantityReserved - row.quantityUnavailable, 0);
            if (available < line.quantityApproved) throw fail(`Kho tá»•ng chá»‰ cÃ²n ${Math.max(0, available)} cÃ¡i kháº£ dá»¥ng cho biáº¿n thá»ƒ nÃ y.`, 409);
          }
        }
        detail.quantityApproved = line.quantityApproved;
        detail.pickAllocations = [];
        if (line.quantityApproved > 0) anyApproved = true;
        await detail.save({ session });
      }
      if (!anyApproved) throw fail('Cáº§n duyá»‡t sá»‘ lÆ°á»£ng lá»›n hÆ¡n 0 cho Ã­t nháº¥t má»™t máº·t hÃ ng.');
      transfer.status = 'approved';
      transfer.assignedStaffId = decision.assignedStaffId;
      transfer.approvedBy = user._id;
      transfer.approvedAt = new Date();
      if (decision.note) transfer.note = `${transfer.note || ''}\nDuyá»‡t: ${decision.note}`.trim();
      await transfer.save({ session });
    });
  } finally { await session.endSession(); }
  return getTransfer(transferId, user);
};

export const getTransferPickCandidates = async (transferId, detailId, storageId, user) => {
  if (!['warehouse_staff', 'warehouse_manager', 'admin'].includes(roleOf(user))) throw fail('Báº¡n khÃ´ng cÃ³ quyá»n soáº¡n hÃ ng.', 403);
  const transfer = await StockTransfer.findById(transferId);
  if (!transfer) throw fail('KhÃ´ng tÃ¬m tháº¥y phiáº¿u Ä‘iá»u chuyá»ƒn.', 404);
  if (roleOf(user) === 'warehouse_staff' && String(transfer.assignedStaffId) !== String(user._id)) throw fail('Phiáº¿u nÃ y chÆ°a Ä‘Æ°á»£c giao cho báº¡n.', 403);
  if (transfer.status !== 'approved') throw fail('Phiáº¿u chÆ°a á»Ÿ tráº¡ng thÃ¡i chá» soáº¡n hÃ ng.', 409);
  const detail = await StockTransferDetail.findOne({ _id: detailId, transferId });
  if (!detail) throw fail('KhÃ´ng tÃ¬m tháº¥y dÃ²ng hÃ ng.', 404);
  const storage = storageId && storageId !== 'none' ? storageId : null;
  if (storage && !await StorageLocation.exists({ _id: storage, locationId: transfer.fromLocationId, status: 'active' })) throw fail('Vá»‹ trÃ­ khÃ´ng thuá»™c kho tá»•ng hoáº·c Ä‘Ã£ ngá»«ng hoáº¡t Ä‘á»™ng.');
  const variant = await ProductVariant.findById(detail.variantId).select('productId').populate('productId', 'trackingType').lean();
  if (variant?.productId?.trackingType === 'individual') return InventoryItem.find({ locationId: transfer.fromLocationId, storageId: storage, variantId: detail.variantId, status: 'available' }).select('_id itemCode serialNumber condition status').sort({ createdAt: 1 }).lean();
  const balance = await InventoryBalance.findOne({ locationId: transfer.fromLocationId, storageId: storage, variantId: detail.variantId }).select('quantityOnHand quantityReserved quantityUnavailable').lean();
  return { available: Math.max(0, (balance?.quantityOnHand || 0) - (balance?.quantityReserved || 0) - (balance?.quantityUnavailable || 0)) };
};

export const saveTransferPick = async (transferId, payload, user) => {
  if (!['warehouse_staff', 'warehouse_manager', 'admin'].includes(roleOf(user))) throw fail('Báº¡n khÃ´ng cÃ³ quyá»n soáº¡n hÃ ng.', 403);
  const data = validateTransferPick(payload);
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const transfer = await StockTransfer.findOne({ _id: transferId, status: 'approved' }).session(session);
    if (!transfer) throw fail('Phiáº¿u chÆ°a á»Ÿ tráº¡ng thÃ¡i chá» soáº¡n hÃ ng.', 409);
    if (roleOf(user) === 'warehouse_staff' && String(transfer.assignedStaffId) !== String(user._id)) throw fail('Phiáº¿u nÃ y chÆ°a Ä‘Æ°á»£c giao cho báº¡n.', 403);
    const details = await StockTransferDetail.find({ transferId }).session(session);
    const byId = new Map(details.map((line) => [String(line._id), line]));
    if (data.items.length !== details.filter((line) => line.quantityApproved > 0).length || data.items.some((line) => !byId.has(line.detailId))) throw fail('PhÃ¢n bá»• Ä‘áº§y Ä‘á»§ cÃ¡c dÃ²ng hÃ ng Ä‘Ã£ duyá»‡t.');
    for (const line of data.items) {
      const detail = byId.get(line.detailId);
      if (line.allocations.reduce((sum, row) => sum + row.quantity, 0) !== detail.quantityApproved) throw fail('Tá»•ng sá»‘ lÆ°á»£ng cÃ¡c vá»‹ trÃ­ pháº£i báº±ng sá»‘ lÆ°á»£ng Ä‘Æ°á»£c duyá»‡t.');
      const variant = await ProductVariant.findById(detail.variantId).select('productId').populate('productId', 'trackingType').session(session).lean();
      const individual = variant?.productId?.trackingType === 'individual';
      for (const allocation of line.allocations) {
        if (allocation.storageId && !await StorageLocation.exists({ _id: allocation.storageId, locationId: transfer.fromLocationId, status: 'active' }).session(session)) throw fail('Vá»‹ trÃ­ xuáº¥t khÃ´ng thuá»™c kho tá»•ng hoáº·c Ä‘Ã£ ngá»«ng hoáº¡t Ä‘á»™ng.');
        if (individual) {
          if (allocation.itemIds.length !== allocation.quantity) throw fail('Chá»n Ä‘Ãºng sá»‘ InventoryItem cho tá»«ng vá»‹ trÃ­.');
          const count = await InventoryItem.countDocuments({ _id: { $in: allocation.itemIds }, locationId: transfer.fromLocationId, storageId: allocation.storageId, variantId: detail.variantId, status: 'available' }).session(session);
          if (count !== allocation.quantity) throw fail('Má»™t sá»‘ InventoryItem Ä‘Ã£ thay Ä‘á»•i vá»‹ trÃ­ hoáº·c tráº¡ng thÃ¡i.', 409);
        } else {
          if (allocation.itemIds.length) throw fail('Máº·t hÃ ng quáº£n lÃ½ theo sá»‘ lÆ°á»£ng khÃ´ng cáº§n chá»n InventoryItem.');
          const balance = await InventoryBalance.findOne({ locationId: transfer.fromLocationId, storageId: allocation.storageId, variantId: detail.variantId }).session(session);
          const available = (balance?.quantityOnHand || 0) - (balance?.quantityReserved || 0) - (balance?.quantityUnavailable || 0);
          if (available < allocation.quantity) throw fail(`Vá»‹ trÃ­ chá»‰ cÃ²n ${Math.max(0, available)} cÃ¡i kháº£ dá»¥ng.`, 409);
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
      const transfer = await StockTransfer.findOne({ _id: transferId, status: 'preparing' }).session(session);
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
  if (current + added > location.maxCapacity) throw fail(`Kho chi nhÃ¡nh khÃ´ng Ä‘á»§ sá»©c chá»©a. CÃ²n ${Math.max(0, location.maxCapacity - current)} cÃ¡i.`, 409);
};

export const receiveTransfer = async (transferId, payload, user) => {
  if (!isBranchManager(user)) throw fail('Chá»‰ quáº£n lÃ½ chi nhÃ¡nh má»›i Ä‘Æ°á»£c xÃ¡c nháº­n nháº­n hÃ ng.', 403);
  const receipt = validateTransferReceipt(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: transferId, status: { $in: ['shipped', 'partially_received'] } }).session(session);
      if (!transfer) throw fail('Phiáº¿u chÆ°a Ä‘Æ°á»£c xuáº¥t tá»« kho tá»•ng hoáº·c Ä‘Ã£ hoÃ n táº¥t nháº­n hÃ ng.', 409);
      const destination = await assertBranchOwnsLocation(transfer.toLocationId, user);
      const details = await StockTransferDetail.find({ transferId }).session(session);
      const detailById = new Map(details.map((detail) => [String(detail._id), detail]));
      if (receipt.items.length !== details.length || receipt.items.some((line) => !detailById.has(line.detailId))) throw fail('Cáº§n xÃ¡c nháº­n Ä‘áº§y Ä‘á»§ cÃ¡c dÃ²ng hÃ ng trong phiáº¿u.');
      const variants = await ProductVariant.find({ _id: { $in: details.map((detail) => detail.variantId) } }).select('productId').populate('productId', 'trackingType').session(session).lean();
      const tracking = new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
      const incoming = receipt.items.map((line) => {
        const detail = detailById.get(line.detailId);
        return { variantId: detail.variantId, quantity: Math.max(0, line.quantityReceived - detail.quantityReceived) };
      }).filter((line) => line.quantity > 0);
      await assertBranchCapacity(destination, incoming, session);
      for (const line of receipt.items) {
        const detail = detailById.get(line.detailId);
        if (line.quantityReceived < detail.quantityReceived || line.quantityReceived > detail.quantityShipped) throw fail('Sá»‘ lÆ°á»£ng nháº­n pháº£i tá»« sá»‘ Ä‘Ã£ nháº­n trÆ°á»›c Ä‘Ã³ Ä‘áº¿n sá»‘ lÆ°á»£ng Ä‘Ã£ xuáº¥t.');
        if (line.quantityDamaged < detail.quantityDamaged || line.quantityDamaged > line.quantityReceived) throw fail('Sá»‘ lÆ°á»£ng há»ng khÃ´ng há»£p lá»‡.');
        const individual = tracking.get(String(detail.variantId)) === 'individual';
        const previousReceived = new Set((detail.receivedItemIds || []).map(String));
        if (individual) {
          const shippedIds = new Set(detail.itemIds.map(String));
          const receivedIds = new Set(line.receivedItemIds);
          const damagedIds = new Set(line.damagedItemIds);
          if (receivedIds.size !== line.quantityReceived || [...receivedIds].some((id) => !shippedIds.has(id))) throw fail('Danh sÃ¡ch mÃ£ cÃ¡ thá»ƒ nháº­n khÃ´ng khá»›p sá»‘ lÆ°á»£ng hoáº·c phiáº¿u xuáº¥t.');
          if (damagedIds.size !== line.quantityDamaged || [...damagedIds].some((id) => !receivedIds.has(id))) throw fail('Danh sÃ¡ch mÃ£ cÃ¡ thá»ƒ há»ng khÃ´ng há»£p lá»‡.');
          if ([...previousReceived].some((id) => !receivedIds.has(id))) throw fail('KhÃ´ng thá»ƒ bá» mÃ£ hÃ ng Ä‘Ã£ xÃ¡c nháº­n nháº­n á»Ÿ láº§n trÆ°á»›c.');
        } else if (line.receivedItemIds.length || line.damagedItemIds.length) throw fail('KhÃ´ng gá»­i mÃ£ cÃ¡ thá»ƒ cho biáº¿n thá»ƒ quáº£n lÃ½ theo sá»‘ lÆ°á»£ng.');
        const receivedDelta = line.quantityReceived - detail.quantityReceived;
        const damagedDelta = line.quantityDamaged - detail.quantityDamaged;
        const previousDamaged = new Set((detail.damagedItemIds || []).map(String));
        if (individual && [...previousDamaged].some((id) => !line.damagedItemIds.includes(id))) throw fail('KhÃ´ng thá»ƒ bá» tráº¡ng thÃ¡i há»ng Ä‘Ã£ ghi nháº­n á»Ÿ láº§n trÆ°á»›c.');
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
            if (!item) throw fail('Má»™t mÃ£ hÃ ng cÃ¡ thá»ƒ khÃ´ng cÃ²n á»Ÿ tráº¡ng thÃ¡i/vá»‹ trÃ­ dá»± kiáº¿n.', 409);
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
            if (balance.quantityOnHand < balance.quantityReserved + balance.quantityUnavailable) throw fail('Sá»‘ lÆ°á»£ng kháº£ dá»¥ng cá»§a chi nhÃ¡nh khÃ´ng thá»ƒ Ã¢m.', 409);
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
      if (receipt.note) transfer.note = `${transfer.note || ''}\nNháº­n hÃ ng: ${receipt.note}`.trim();
      await transfer.save({ session });
    });
  } finally { await session.endSession(); }
  return getTransfer(transferId, user);
};
