// Hàm thuần (không import model, có unit test) cho màn tồn kho:
// - lịch sử một mã hàng: đọc tham số, mô tả từ → đến của dòng sổ, ghép cặp xuất / nhập cùng phiếu;
// - sức chứa kho tổng: ngưỡng màu và cây Khu → Dãy → Kệ từ số "đang chứa" của capacitySnapshot.

export const HISTORY_TABS = ['movements', 'maintenance'];
export const DEFAULT_HISTORY_LIMIT = 10;
export const MAX_HISTORY_LIMIT = 50;

/** tab (movements|maintenance), page ≥ 1, limit 1..50. */
export const parseHistoryQuery = (query = {}) => {
  const tab = HISTORY_TABS.includes(query.tab) ? query.tab : 'movements';
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_HISTORY_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_HISTORY_LIMIT));
  return { tab, page, limit, skip: (page - 1) * limit };
};

const IN_TYPES = ['inbound', 'transfer_in', 'rental_return', 'sales_return'];

/** Một dòng sổ chỉ có một phía: nhập → "đến" là nơi ghi; xuất / thanh lý / bán → "từ" là nơi ghi. */
export const describeMovement = (row) => {
  const place = { location: row.locationId || null, storage: row.storageId || null };
  const incoming = IN_TYPES.includes(row.movementType) || (row.movementType === 'adjustment' && Number(row.quantityChange) > 0);
  return incoming ? { from: null, to: place } : { from: place, to: null };
};

const sameRef = (left, right) => String(left.referenceId || '') === String(right.referenceId || '')
  && String(left.referenceType || '') === String(right.referenceType || '');

/**
 * Ghép cặp transfer_out + transfer_in của cùng một phiếu (dời kệ, điều chuyển) thành một dòng "từ → đến".
 * `rows` sắp mới nhất trước; chỉ ghép hai dòng liền nhau trong cùng trang.
 */
export const pairItemMovements = (rows) => {
  const result = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const next = rows[index + 1];
    const described = describeMovement(row);
    const pairable = next && sameRef(row, next)
      && ((row.movementType === 'transfer_in' && next.movementType === 'transfer_out')
        || (row.movementType === 'transfer_out' && next.movementType === 'transfer_in'));
    if (pairable) {
      const outRow = row.movementType === 'transfer_out' ? row : next;
      const inRow = row.movementType === 'transfer_in' ? row : next;
      result.push({
        ...inRow,
        movementType: 'move',
        from: describeMovement(outRow).from,
        to: describeMovement(inRow).to,
        movementIds: [outRow._id, inRow._id],
      });
      index += 1;
      continue;
    }
    result.push({ ...row, ...described, movementIds: [row._id] });
  }
  return result;
};

/** Lịch sử chưa đầy đủ khi món có trước dòng sổ sớm nhất ghi theo mã hàng (dữ liệu cũ không suy ngược). */
export const isHistoryIncomplete = (itemCreatedAt, earliestMovementAt, toleranceMs = 60 * 1000) => {
  if (!itemCreatedAt) return false;
  if (!earliestMovementAt) return true;
  return new Date(earliestMovementAt).getTime() - new Date(itemCreatedAt).getTime() > toleranceMs;
};

/* ------------------------------ Sức chứa ------------------------------ */

/** Ngưỡng màu: < 80% bình thường, 80–95% vàng, > 95% đỏ. Không đặt tối đa → 'none' (chỉ hiện số đang chứa). */
export const capacityTone = (used, maxCapacity) => {
  if (maxCapacity == null || maxCapacity === '') return 'none';
  const max = Number(maxCapacity);
  const value = Math.max(0, Number(used) || 0);
  if (!(max > 0)) return value > 0 ? 'danger' : 'normal';
  const percent = (value / max) * 100;
  if (percent > 95) return 'danger';
  if (percent >= 80) return 'warning';
  return 'normal';
};

export const capacityPercent = (used, maxCapacity) => {
  const max = Number(maxCapacity);
  if (maxCapacity == null || !(max > 0)) return null;
  return Math.round(((Math.max(0, Number(used) || 0) / max) * 100) * 10) / 10;
};

const capacityNode = (storage, usedById) => {
  const used = usedById.get(String(storage._id)) || 0;
  const maxCapacity = storage.maxCapacity ?? null;
  return {
    _id: String(storage._id),
    code: storage.code || '',
    name: storage.name || '',
    type: storage.type || '',
    status: storage.status || 'active',
    maxCapacity,
    used,
    percent: capacityPercent(used, maxCapacity),
    tone: capacityTone(used, maxCapacity),
    children: [],
  };
};

/**
 * Cây Khu → Dãy → Kệ. `usedById` là Map storageId → số đang chứa ĐÃ cộng dồn lên cấp cha
 * (đúng `usedWithAncestors` của capacitySnapshot), nên ở đây không cộng lại lần nữa.
 * Nút có cha không tồn tại (dữ liệu lỗi / vòng lặp) được đưa lên gốc.
 */
export const buildCapacityTree = (storages, usedById) => {
  const nodes = new Map(storages.map((storage) => [String(storage._id), capacityNode(storage, usedById)]));
  const parentOf = new Map(storages.map((storage) => [String(storage._id), storage.parentStorageId ? String(storage.parentStorageId) : null]));
  const roots = [];
  for (const storage of storages) {
    const node = nodes.get(String(storage._id));
    const parentId = storage.parentStorageId ? String(storage.parentStorageId) : null;
    const parent = parentId && parentId !== node._id ? nodes.get(parentId) : null;
    if (parent && !isAncestor(parentOf, node._id, parentId)) parent.children.push(node);
    else roots.push(node);
  }
  const sortTree = (list) => {
    list.sort((left, right) => left.code.localeCompare(right.code, 'vi', { numeric: true }));
    list.forEach((node) => sortTree(node.children));
    return list;
  };
  return sortTree(roots);
};

/** `candidateId` có phải tổ tiên của `parentId` không (chống vòng lặp cha-con). */
function isAncestor(parentOf, candidateId, parentId) {
  const visited = new Set();
  let cursor = parentId;
  while (cursor && !visited.has(cursor)) {
    if (cursor === candidateId) return true;
    visited.add(cursor);
    cursor = parentOf.get(cursor);
  }
  return false;
}

/** Thẻ tổng của kho tổng. */
export const capacitySummary = (location, used, committed = 0) => {
  const maxCapacity = location?.maxCapacity ?? null;
  return {
    locationId: location?._id ? String(location._id) : null,
    code: location?.code || '',
    name: location?.name || '',
    used,
    committed,
    maxCapacity,
    percent: capacityPercent(used, maxCapacity),
    tone: capacityTone(used, maxCapacity),
  };
};
