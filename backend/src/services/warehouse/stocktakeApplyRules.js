// TASK-016 B — Hàm thuần cho bước "duyệt = áp dụng" của kiểm kê (không import model, có unit test).
// Mỗi dòng kiểm kê là một món. Lúc duyệt, mỗi dòng được lập "kế hoạch" từ kết quả nhân viên ghi
// (`countedResult`, `foundStorageId`) và trạng thái hiện tại của món, rồi service mới ghi DB theo kế hoạch.
//
// Kết quả → xử lý (bảng B3):
//   ok             không đổi trạng thái; kệ thực tế khác kệ hệ thống → chuyển kệ.
//   needs_service  available → unavailable; reserved → nhả phiếu đang giữ rồi unavailable; unavailable/maintenance giữ nguyên.
//   not_found      → lost (sổ −1).
//   món lạ         mã đang lost → available tại kệ đang kiểm (sổ +1); mã ở kệ khác → chuyển về kệ đang kiểm;
//                  mã chưa có → tạo món mới available (sổ +1).
// Món đổi trạng thái/vị trí sau lúc bắt đầu kiểm (bị soạn, bán, chuyển…) → bỏ qua dòng, ghi lý do.

export const COUNT_RESULTS = Object.freeze(['ok', 'needs_service', 'not_found']);
/** Món ở các trạng thái này đang nằm trong kho nên được kiểm kê. */
export const IN_STOCK_STATUSES = Object.freeze(['available', 'reserved', 'unavailable', 'maintenance']);
export const NOT_IN_STOCK_STATUSES = Object.freeze(['disposed', 'renting', 'in_transit', 'sold', 'lost']);

export const OUTCOMES = Object.freeze({
  UNCHANGED: 'unchanged',
  NEEDS_SERVICE: 'needs_service',
  LOST: 'lost',
  FOUND: 'found',
  CREATED: 'created',
  RELOCATED: 'relocated',
  SKIPPED: 'skipped',
});

const STATUS_TEXT = {
  available: 'sẵn sàng', reserved: 'đang giữ', unavailable: 'cần xử lý', maintenance: 'đang giặt/sửa',
  in_transit: 'đang điều chuyển', renting: 'đang cho thuê', sold: 'đã bán', disposed: 'đã thanh lý', lost: 'mất',
};
const statusText = (status) => STATUS_TEXT[status] || status || 'không rõ';

const idOf = (value) => String(value?._id ?? value ?? '');
const sameId = (left, right) => idOf(left) === idOf(right);
const skip = (reason) => ({ outcome: OUTCOMES.SKIPPED, skippedReason: reason });

/** Ảnh chụp lưu lúc bắt đầu kiểm (dòng thường) hoặc lúc ghi món lạ (dòng `isExtra`). */
export const snapshotOf = (item) => ({
  statusAtStart: item.status,
  locationAtStart: item.locationId?._id ?? item.locationId ?? null,
  storageAtStart: item.storageId?._id ?? item.storageId ?? null,
});

/** Lý do bỏ qua nếu món đã khác ảnh chụp, ngược lại null. */
export const changedSinceStart = (detail, item, locationId) => {
  if (!detail.statusAtStart) return 'Dòng không có ảnh chụp lúc bắt đầu kiểm (phiếu bắt đầu trước khi nâng cấp).';
  const startLocation = detail.locationAtStart || locationId;
  const moved = !sameId(item.locationId, startLocation) || !sameId(item.storageId || null, detail.storageAtStart || null);
  if (item.status === detail.statusAtStart && !moved) return null;
  const now = moved ? `${statusText(item.status)}, đã đổi vị trí` : statusText(item.status);
  return `Món đã thay đổi sau khi bắt đầu kiểm (lúc bắt đầu: ${statusText(detail.statusAtStart)}, hiện tại: ${now}).`;
};

/** Kết quả đạt / cần xử lý của món có mặt; `target` là kệ thực tế. */
const planPresent = ({ result, item, from, target }) => {
  const moved = !sameId(target, from);
  const base = { fromStorageId: from, toStorageId: target, moved };
  if (result === 'needs_service') {
    if (item.status === 'available') return { ...base, outcome: OUTCOMES.NEEDS_SERVICE, change: { status: 'unavailable', storageId: target } };
    if (item.status === 'reserved') {
      return { ...base, outcome: OUTCOMES.NEEDS_SERVICE, releaseHold: true, change: { status: 'unavailable', storageId: target, warehouseHold: -1 } };
    }
    // unavailable / maintenance: đã chờ hoặc đang xử lý, kiểm kê không thay giặt/sửa.
    return { ...base, outcome: OUTCOMES.NEEDS_SERVICE, change: moved ? { storageId: target } : null };
  }
  if (!moved) return { ...base, outcome: OUTCOMES.UNCHANGED, change: null };
  if (item.status === 'reserved') return skip('Món đang được giữ cho phiếu di chuyển kệ nên không chuyển kệ được; xử lý phiếu đó trước.');
  return { ...base, outcome: OUTCOMES.RELOCATED, change: { storageId: target } };
};

const planNotFound = (item, from) => {
  if (item.status === 'maintenance') return skip('Món đang có phiếu giặt/sửa; hủy hoặc hoàn tất phiếu đó trước khi ghi mất.');
  const base = { outcome: OUTCOMES.LOST, fromStorageId: from, toStorageId: null, moved: false, movement: -1 };
  if (item.status === 'reserved') return { ...base, releaseHold: true, change: { status: 'lost', warehouseHold: -1 } };
  return { ...base, change: { status: 'lost' } };
};

/** Món lạ có mã trong hệ thống: mã đang mất → tìm thấy; món ở kho này → xử lý như món có mặt ở kệ đang kiểm. */
const planExtraItem = ({ detail, item, locationId, target }) => {
  if (detail.countedResult === 'not_found') return skip('Món lạ không thể ghi "Không thấy".');
  if (item.status === 'lost') {
    const status = detail.countedResult === 'needs_service' ? 'unavailable' : 'available';
    return {
      outcome: OUTCOMES.FOUND, fromStorageId: null, toStorageId: target, moved: true, movement: 1,
      change: { status, locationId, storageId: target },
    };
  }
  if (!sameId(item.locationId, locationId) || !IN_STOCK_STATUSES.includes(item.status)) {
    return skip(`Mã ${item.itemCode || idOf(item._id)} đang ${statusText(item.status)} ở nơi khác; cần kiểm tra lại.`);
  }
  return null;
};

/**
 * Lập kế hoạch cho một dòng. `item` = món hiện tại (null nếu dòng là món mới chưa có mã trong hệ thống).
 * Trả về { outcome, change?, releaseHold?, movement?, fromStorageId?, toStorageId?, moved?, skippedReason? }.
 * `change` truyền thẳng cho itemStateService.moveItem; null = không đổi món.
 */
export const planStocktakeLine = (detail, item, { locationId }) => {
  if (!detail.itemId) {
    const target = detail.foundStorageId || detail.storageId;
    if (!target) return skip('Món mới chưa chọn kệ.');
    const status = detail.countedResult === 'needs_service' ? 'unavailable' : 'available';
    return { outcome: OUTCOMES.CREATED, fromStorageId: null, toStorageId: target, moved: true, movement: 1, status };
  }
  if (!item) return skip('Món không còn trong hệ thống.');
  const changed = changedSinceStart(detail, item, locationId);
  if (changed) return skip(changed);
  const from = item.storageId?._id ?? item.storageId ?? null;
  const target = detail.foundStorageId || (detail.isExtra ? detail.storageId : null) || from;
  if (detail.isExtra) {
    const extraPlan = planExtraItem({ detail, item, locationId, target });
    if (extraPlan) return extraPlan;
  }
  if (detail.countedResult === 'not_found') return planNotFound(item, from);
  if (!COUNT_RESULTS.includes(detail.countedResult)) return skip('Dòng chưa có kết quả kiểm.');
  return planPresent({ result: detail.countedResult, item, from, target });
};

/** Phần thay đổi chỗ trên kệ của các kế hoạch: [{ storageId, quantity }] (+ thêm vào kệ, − rời kệ). */
export const capacityDeltasOf = (plans) => {
  const rows = [];
  for (const plan of plans) {
    if (plan.outcome === OUTCOMES.SKIPPED) continue;
    if (plan.outcome === OUTCOMES.LOST) rows.push({ storageId: plan.fromStorageId, quantity: -1 });
    else if (plan.outcome === OUTCOMES.CREATED || plan.outcome === OUTCOMES.FOUND) rows.push({ storageId: plan.toStorageId, quantity: 1 });
    else if (plan.moved) {
      rows.push({ storageId: plan.fromStorageId, quantity: -1 });
      rows.push({ storageId: plan.toStorageId, quantity: 1 });
    }
  }
  return rows;
};

const addToChain = (totals, storageById, storageId, quantity) => {
  let current = storageId ? storageById.get(idOf(storageId)) : null;
  const visited = new Set();
  while (current && !visited.has(idOf(current._id))) {
    const key = idOf(current._id);
    visited.add(key);
    totals.set(key, (totals.get(key) || 0) + quantity);
    current = current.parentStorageId ? storageById.get(idOf(current.parentStorageId)) : null;
  }
};

/**
 * Kệ / khu / kho bị vượt sức chứa sau khi áp dụng. Chỉ xét nơi nhận thêm hàng (tăng ròng > 0).
 * snapshot: { storageById, usedWithAncestors: Map, used, location: { maxCapacity } } (như shared/capacity.capacitySnapshot).
 * Trả về [{ code, projected, maxCapacity }].
 */
export const capacityViolations = (snapshot, deltas) => {
  const changeByStorage = new Map();
  let total = 0;
  for (const row of deltas) {
    total += row.quantity;
    if (row.storageId) addToChain(changeByStorage, snapshot.storageById, row.storageId, row.quantity);
  }
  const violations = [];
  for (const [storageId, change] of changeByStorage) {
    const storage = snapshot.storageById.get(storageId);
    if (change <= 0 || storage?.maxCapacity == null) continue;
    const projected = (snapshot.usedWithAncestors.get(storageId) || 0) + change;
    if (projected > storage.maxCapacity) violations.push({ code: storage.code || storageId, projected, maxCapacity: storage.maxCapacity });
  }
  const maxCapacity = snapshot.location?.maxCapacity;
  if (total > 0 && maxCapacity != null && snapshot.used + total > maxCapacity) {
    violations.push({ code: snapshot.location.code || 'kho', projected: snapshot.used + total, maxCapacity });
  }
  return violations;
};

/** Tổng kết sau duyệt (màn chi tiết): số món đúng / cần xử lý / mất / tìm thấy / chuyển kệ / bị bỏ qua. */
export const summarizeOutcomes = (details) => {
  const summary = { unchanged: 0, needsService: 0, lost: 0, found: 0, relocated: 0, skipped: 0 };
  for (const detail of details || []) {
    const outcome = detail.appliedOutcome;
    if (outcome === OUTCOMES.UNCHANGED) summary.unchanged += 1;
    else if (outcome === OUTCOMES.NEEDS_SERVICE) summary.needsService += 1;
    else if (outcome === OUTCOMES.LOST) summary.lost += 1;
    else if (outcome === OUTCOMES.FOUND || outcome === OUTCOMES.CREATED) summary.found += 1;
    else if (outcome === OUTCOMES.RELOCATED) summary.relocated += 1;
    else if (outcome === OUTCOMES.SKIPPED) summary.skipped += 1;
  }
  return summary;
};
