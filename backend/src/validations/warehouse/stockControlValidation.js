import { damagedQuantityError } from '../../services/warehouse/stocktakeRules.js';

const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const idList = (value, label) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw invalid(`${label} phải là một danh sách.`);
  const ids = [...new Set(value.map((id) => String(id)))];
  if (ids.some((id) => !/^[a-f\d]{24}$/i.test(id))) throw invalid(`${label} có mã không hợp lệ.`);
  return ids;
};

export const validateCreateStocktakeInput = (payload) => {
  if (!isObject(payload)) throw invalid('Dữ liệu tạo phiếu kiểm kê không hợp lệ.');
  const locationId = String(payload.locationId || '');
  if (!/^[a-f\d]{24}$/i.test(locationId)) throw invalid('Chọn kho/cửa hàng hợp lệ.');
  if (!['full', 'product', 'storage_location', 'custom'].includes(payload.scopeType)) throw invalid('Phạm vi kiểm kê không hợp lệ.');
  const productIds = idList(payload.productIds, 'Danh sách sản phẩm');
  const variantIds = idList(payload.variantIds, 'Danh sách biến thể');
  const storageIds = idList(payload.storageIds, 'Danh sách vị trí');
  if (payload.scopeType === 'product' && (variantIds.length === 0 || productIds.length || storageIds.length)) throw invalid('Phạm vi theo biến thể yêu cầu ít nhất một biến thể.');
  if (payload.scopeType === 'storage_location' && (storageIds.length === 0 || productIds.length || variantIds.length)) throw invalid('Phạm vi theo vị trí yêu cầu ít nhất một vị trí lưu trữ.');
  if (payload.scopeType === 'full' && (productIds.length || variantIds.length || storageIds.length)) throw invalid('Phạm vi toàn kho không nhận bộ lọc sản phẩm hoặc vị trí.');
  const assignedStaffId = payload.assignedStaffId ? String(payload.assignedStaffId) : null;
  if (assignedStaffId && !/^[a-f\d]{24}$/i.test(assignedStaffId)) throw invalid('Nhân viên được giao không hợp lệ.');
  const lines = parseStocktakeLines(payload.lines);
  return { locationId, scopeType: payload.scopeType, productIds, variantIds, storageIds, assignedStaffId, lines };
};

export const MAX_STOCKTAKE_LINES = 5000;

/**
 * Danh sách cặp (biến thể, vị trí) WM chọn từ bảng "Lấy danh sách hàng hóa". Không gửi → null (hành vi cũ:
 * lấy mọi dòng trong phạm vi). `storageId` null = dòng không có kệ. Cặp trùng được gộp.
 */
export const parseStocktakeLines = (value) => {
  if (value == null) return null;
  if (!Array.isArray(value)) throw invalid('Danh sách dòng kiểm kê phải là một danh sách.');
  if (!value.length) throw invalid('Chọn ít nhất một dòng hàng để kiểm kê.');
  if (value.length > MAX_STOCKTAKE_LINES) throw invalid(`Một phiếu kiểm kê tối đa ${MAX_STOCKTAKE_LINES} dòng.`);
  const seen = new Map();
  for (const line of value) {
    if (!isObject(line)) throw invalid('Dòng kiểm kê không hợp lệ.');
    const variantId = String(line.variantId || '');
    const storageId = line.storageId == null || line.storageId === '' ? null : String(line.storageId);
    if (!/^[a-f\d]{24}$/i.test(variantId)) throw invalid('Dòng kiểm kê có biến thể không hợp lệ.');
    if (storageId && !/^[a-f\d]{24}$/i.test(storageId)) throw invalid('Dòng kiểm kê có vị trí không hợp lệ.');
    seen.set(`${variantId}|${storageId || ''}`, { variantId, storageId });
  }
  return [...seen.values()];
};

export const validateStocktakeCountInput = (payload) => {
  if (!isObject(payload)) throw invalid('Dữ liệu kiểm đếm không hợp lệ.');
  const items = payload.items == null ? [] : payload.items;
  const newItems = payload.newItems == null ? [] : payload.newItems;
  if (!Array.isArray(items) || !Array.isArray(newItems)) throw invalid('Các dòng kiểm đếm phải là danh sách.');
  for (const item of items) {
    if (!isObject(item) || !/^[a-f\d]{24}$/i.test(String(item.detailId || ''))) throw invalid('Dòng kiểm đếm có mã không hợp lệ.');
    if (!Number.isInteger(Number(item.countedQuantity)) || Number(item.countedQuantity) < 0) throw invalid('Số lượng thực tế phải là số nguyên không âm.');
    if (item.countedItemStatus != null && !['available', 'reserved', 'maintenance', 'unavailable'].includes(item.countedItemStatus)) throw invalid('Trạng thái món hàng kiểm kê không hợp lệ.');
    if (item.countedCondition != null && !['new', 'good', 'worn', 'damaged', 'unrepairable', 'missing'].includes(item.countedCondition)) throw invalid('Tình trạng món hàng kiểm kê không hợp lệ.');
    const damagedError = damagedQuantityError(item.damagedQuantity, item.countedQuantity);
    if (damagedError) throw invalid(damagedError);
  }
  for (const item of newItems) {
    if (!isObject(item) || !/^[a-f\d]{24}$/i.test(String(item.variantId || ''))) throw invalid('Dòng hàng ngoài hệ thống có biến thể không hợp lệ.');
    if (item.countedItemStatus != null && !['available', 'reserved', 'maintenance', 'unavailable'].includes(item.countedItemStatus)) throw invalid('Trạng thái món hàng mới không hợp lệ.');
    if (item.countedCondition != null && !['new', 'good', 'worn', 'damaged', 'unrepairable', 'missing'].includes(item.countedCondition)) throw invalid('Tình trạng món hàng mới không hợp lệ.');
    const damagedError = damagedQuantityError(item.damagedQuantity, item.countedQuantity ?? null);
    if (damagedError) throw invalid(damagedError);
  }
  return { items, newItems };
};

export const validateCancelReason = (payload) => {
  const raw = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.reason : undefined;
  if (raw != null && typeof raw !== 'string') throw invalid('Lý do hủy phiếu không hợp lệ.');
  const reason = String(raw || '').trim();
  if (!reason) throw invalid('Vui lòng nhập lý do hủy phiếu.');
  if (reason.length > 500) throw invalid('Lý do hủy phiếu tối đa 500 ký tự.');
  return { reason };
};
