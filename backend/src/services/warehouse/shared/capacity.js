// Kiểm tra sức chứa khi đưa hàng vào kho tổng hoặc chi nhánh.
// "Đã dùng" chỉ đọc InventoryBalance.quantityOnHand cho mọi loại hàng: balance của hàng `individual`
// luôn đồng bộ với các món (itemStateService) nên không đếm InventoryItem riêng để tránh đếm hai lần.
// Tách khỏi stockTransferService / branchReturnService để bỏ import vòng với stockDiscrepancyService.
import { InventoryBalance } from '../../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryLocation } from '../../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../../models/warehouse/location/StorageLocation.js';
import { StockTransfer } from '../../../models/warehouse/transfer/StockTransfer.js';
import { StockTransferDetail } from '../../../models/warehouse/transfer/StockTransferDetail.js';
import { InboundReceipt } from '../../../models/warehouse/inbound/InboundReceipt.js';
import { InboundReceiptDetail } from '../../../models/warehouse/inbound/InboundReceiptDetail.js';
import { appError } from './errors.js';

const OPEN_RECEIPT_STATUSES = ['awaiting_receiving', 'received', 'approved'];
const OPEN_RETURN_STATUSES = ['approved', 'shipped', 'receipt_submitted', 'receipt_approved'];

const positive = (value) => Math.max(0, value || 0);

/**
 * Chi nhánh không có kệ nên chỉ kiểm tổng tồn của cả kho cửa hàng so với `maxCapacity`.
 * `incoming`: [{ variantId, quantity }] số sắp nhập thêm.
 */
export const assertBranchCapacity = async (location, incoming, session) => {
  if (location.maxCapacity == null) return;
  const balances = await InventoryBalance.find({ locationId: location._id })
    .select('quantityOnHand').session(session).lean();
  const current = balances.reduce((sum, row) => sum + positive(row.quantityOnHand), 0);
  const added = incoming.reduce((sum, row) => sum + row.quantity, 0);
  if (current + added > location.maxCapacity) {
    const left = Math.max(0, location.maxCapacity - current);
    throw appError(`Kho chi nhánh không đủ sức chứa. Còn ${left} cái.`, 409);
  }
};

/** Cộng `quantity` vào kệ và mọi cấp cha (Kệ → Dãy → Khu). Chống vòng lặp nếu dữ liệu cha-con lỗi. */
export const addToStorageChain = (totals, storageById, storageId, quantity) => {
  let current = storageById.get(String(storageId));
  const visited = new Set();
  while (current && !visited.has(String(current._id))) {
    const key = String(current._id);
    visited.add(key);
    totals.set(key, (totals.get(key) || 0) + quantity);
    current = current.parentStorageId ? storageById.get(String(current.parentStorageId)) : null;
  }
};

const sumUsedByStorage = (balances, storageById) => {
  let used = 0;
  const usedWithAncestors = new Map();
  for (const balance of balances) {
    const quantity = positive(balance.quantityOnHand);
    used += quantity;
    if (balance.storageId) addToStorageChain(usedWithAncestors, storageById, String(balance.storageId), quantity);
  }
  return { used, usedWithAncestors };
};

/** Phiếu nhập đang mở đã "đặt chỗ" sức chứa kho: chờ nhận tính số dự kiến, đã nhận tính số đạt. */
const committedByOpenReceipts = async (locationId, session) => {
  const receipts = await InboundReceipt.find({ locationId, status: { $in: OPEN_RECEIPT_STATUSES } })
    .select('_id status').session(session).lean();
  if (!receipts.length) return 0;
  const statusById = new Map(receipts.map((receipt) => [String(receipt._id), receipt.status]));
  const lines = await InboundReceiptDetail.find({ receiptId: { $in: receipts.map((receipt) => receipt._id) } })
    .select('receiptId quantityExpected quantityReceived quantityDamaged').session(session).lean();
  return lines.reduce((sum, line) => {
    if (statusById.get(String(line.receiptId)) === 'awaiting_receiving') return sum + line.quantityExpected;
    return sum + Math.max(0, line.quantityReceived - line.quantityDamaged);
  }, 0);
};

const returnLineQuantity = (status, line) => {
  if (status === 'approved') return line.quantityApproved;
  if (status === 'shipped') return line.quantityShipped;
  return line.quantityReceived;
};

/** Phiếu trả hàng chi nhánh đang về kho tổng cũng giữ chỗ sức chứa (trừ phiếu đang xử lý). */
const committedByOpenReturns = async (locationId, excludeTransferId, session) => {
  const transfers = await StockTransfer.find({
    direction: 'branch_to_central',
    toLocationId: locationId,
    _id: { $ne: excludeTransferId },
    status: { $in: OPEN_RETURN_STATUSES },
  }).select('_id status').session(session).lean();
  if (!transfers.length) return 0;
  const statusById = new Map(transfers.map((transfer) => [String(transfer._id), transfer.status]));
  const lines = await StockTransferDetail.find({ transferId: { $in: transfers.map((transfer) => transfer._id) } })
    .select('transferId quantityApproved quantityShipped quantityReceived quantityDamaged').session(session).lean();
  return lines.reduce((sum, line) => {
    const status = statusById.get(String(line.transferId));
    return sum + positive(returnLineQuantity(status, line));
  }, 0);
};

/**
 * Ảnh chụp sức chứa của một kho: đã dùng (toàn kho và từng kệ kèm cấp cha) và phần đã cam kết
 * cho phiếu nhập / phiếu trả đang mở. Dùng khi xếp hàng trả về hoặc nhập lại hàng tìm thấy.
 */
export const capacitySnapshot = async (locationId, session, excludeTransferId) => {
  const [location, storages, balances] = await Promise.all([
    InventoryLocation.findById(locationId).session(session).lean(),
    StorageLocation.find({ locationId }).session(session).lean(),
    InventoryBalance.find({ locationId }).select('storageId quantityOnHand').session(session).lean(),
  ]);
  const storageById = new Map(storages.map((row) => [String(row._id), row]));
  const { used, usedWithAncestors } = sumUsedByStorage(balances, storageById);
  const committedReceipts = await committedByOpenReceipts(locationId, session);
  const committedReturns = await committedByOpenReturns(locationId, excludeTransferId, session);
  return { location, storages, storageById, used, usedWithAncestors, committed: committedReceipts + committedReturns };
};
