/**
 * Hàm thuần cho phiếu tách / gộp tồn trong kho tổng.
 * - Tách: một biến thể ở một kệ nguồn → chia sang nhiều kệ đích.
 * - Gộp: một biến thể ở nhiều kệ nguồn → dồn về một kệ đích.
 * Mỗi "nhóm" (group) trong form là một mặt hàng cùng các kệ liên quan (`places`).
 */
import { idOf } from '../shared/slipHelpers';

export const PICKER_PAGE_SIZE = 10;

export const emptyPlace = () => ({ storageId: '', quantity: 1 });

/** Tên dòng tồn: "Tên · SKU · size · màu". */
export const inventoryRowName = (row) => [row.productName, row.sku, row.size, row.color].filter(Boolean).join(' · ');

/** Dòng tồn còn hàng khả dụng ở một kệ, khớp từ khóa tìm (tên, mã, SKU, size, màu, vị trí). */
export function filterAvailable(inventory, query) {
  const keyword = query.toLowerCase();
  return inventory
    .filter((row) => row.storageId && Number(row.quantityAvailable) > 0)
    .filter((row) => {
      if (!keyword) return true;
      const text = [row.productName, row.productCode, row.sku, row.size, row.color, row.storagePath].join(' ');
      return text.toLowerCase().includes(keyword);
    });
}

function addSplitRow(groups, row) {
  const exists = groups.some((group) => idOf(group.variantId) === idOf(row.variantId)
    && idOf(group.fromStorageId) === idOf(row.storageId));
  if (exists) return;
  groups.push({
    variantId: row.variantId,
    label: inventoryRowName(row),
    fromStorageId: row.storageId,
    available: Number(row.quantityAvailable),
    places: [emptyPlace(), emptyPlace()],
  });
}

function addMergeRow(groups, row) {
  const source = {
    storageId: row.storageId,
    quantity: Number(row.quantityAvailable),
    available: Number(row.quantityAvailable),
  };
  const group = groups.find((item) => idOf(item.variantId) === idOf(row.variantId));
  if (!group) {
    groups.push({ variantId: row.variantId, label: inventoryRowName(row), toStorageId: '', places: [source] });
    return;
  }
  const alreadyAdded = group.places.some((place) => idOf(place.storageId) === idOf(row.storageId));
  if (!alreadyAdded) group.places.push(source);
}

/** Thêm các dòng tồn đã chọn vào form; dòng trùng (đã có) thì bỏ qua. */
export function addRowsToGroups(groups, rows, operationType) {
  const next = groups.map((group) => ({ ...group, places: [...group.places] }));
  rows.forEach((row) => {
    if (operationType === 'split') addSplitRow(next, row);
    else addMergeRow(next, row);
  });
  return next;
}

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

function validateSplitGroup(group) {
  const usedShelves = [];
  let total = 0;
  for (const place of group.places) {
    if (!place.storageId) return `Vui lòng chọn kệ đích cho ${group.label}.`;
    if (idOf(place.storageId) === idOf(group.fromStorageId)) return `Kệ đích không được trùng kệ nguồn của ${group.label}.`;
    if (!isPositiveInteger(place.quantity)) return `Số lượng phân bổ của ${group.label} phải là số nguyên lớn hơn 0.`;
    if (usedShelves.includes(idOf(place.storageId))) return `Không được chọn trùng kệ đích cho ${group.label}.`;
    usedShelves.push(idOf(place.storageId));
    total += Number(place.quantity);
  }
  if (total > Number(group.available)) {
    return `Tổng số lượng phân bổ của ${group.label} vượt quá số lượng khả dụng (${group.available}).`;
  }
  return '';
}

function validateMergeGroup(group) {
  if (!group.toStorageId) return `Vui lòng chọn kệ đích cho ${group.label}.`;
  const sourceIds = group.places.map((place) => idOf(place.storageId));
  if (sourceIds.includes(idOf(group.toStorageId))) return `Kệ đích không được trùng với kệ nguồn của ${group.label}.`;
  for (const place of group.places) {
    if (!isPositiveInteger(place.quantity)) return `Số lượng gộp của ${group.label} phải là số nguyên lớn hơn 0.`;
    if (Number(place.quantity) > Number(place.available)) {
      return `Số lượng lấy từ kệ nguồn của ${group.label} vượt quá tồn khả dụng.`;
    }
  }
  return '';
}

/** Kiểm tra form trước khi tạo phiếu; trả message lỗi đầu tiên hoặc ''. */
export function validateGroups(groups, operationType) {
  if (!groups.length) return 'Vui lòng thêm ít nhất một mặt hàng.';
  for (const group of groups) {
    if (!group.places.length) return `Mặt hàng ${group.label} chưa có kệ được chọn.`;
    const message = operationType === 'split' ? validateSplitGroup(group) : validateMergeGroup(group);
    if (message) return message;
  }
  return '';
}

/** Chuyển các nhóm trong form thành dòng phiếu gửi API (mỗi dòng: biến thể, kệ nguồn, kệ đích, số lượng). */
export function buildRelocationItems(groups, operationType) {
  return groups.flatMap((group) => group.places.map((place) => {
    if (operationType === 'split') {
      return { variantId: group.variantId, fromStorageId: group.fromStorageId, toStorageId: place.storageId, quantity: Number(place.quantity) };
    }
    return { variantId: group.variantId, fromStorageId: place.storageId, toStorageId: group.toStorageId, quantity: Number(place.quantity) };
  }));
}

/** Tổng số lượng đã phân bổ (bỏ qua ô trống / số âm). */
export const allocatedTotal = (places) => places
  .reduce((sum, place) => sum + (Number(place.quantity) > 0 ? Number(place.quantity) : 0), 0);

export const groupKey = (group, operationType) => {
  if (operationType === 'split') return `${idOf(group.variantId)}-${idOf(group.fromStorageId)}`;
  return idOf(group.variantId);
};
