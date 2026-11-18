// Dùng chung cho các API danh sách phiếu kho: tìm kiếm, phân trang và gắn chi tiết phiếu
// mà KHÔNG truy vấn riêng cho từng phiếu (tránh N+1).
//
// Số truy vấn cho một trang luôn cố định, không tăng theo số phiếu:
//   1 find (trang hiện tại, kèm các populate cố định) + 1 countDocuments + 1 aggregate chi tiết theo $in
//   (+ tối đa 3 truy vấn tra cứu khi có `search`: Shop, InventoryLocation, User).
import { InventoryLocation } from '../../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../../models/shop/Shop.js';
import User from '../../../models/system/User.js';
import { groupByField, pagedResult, searchRegex } from './pagination.js';

const toPlain = (row) => (typeof row?.toObject === 'function' ? row.toObject() : row);

/** Ghép thêm điều kiện vào filter bằng $and để không đè $or sẵn có (vd lọc theo chi nhánh). */
export const andFilter = (filter, extra) => {
  if (!extra) return filter;
  return { ...filter, $and: [...(filter.$and || []), extra] };
};

/**
 * Điều kiện tìm kiếm: mã phiếu, tên/mã kho hoặc tên chi nhánh, tên người tạo / người phụ trách.
 * Trả về null nếu không có từ khóa.
 */
export const buildSearchFilter = async (search, { codeField, locationFields = [], userFields = [] }) => {
  const regex = searchRegex(search);
  if (!regex) return null;
  const shopIds = await Shop.find({ name: regex }).distinct('_id');
  const locationConditions = [{ code: regex }, { name: regex }];
  if (shopIds.length) locationConditions.push({ shopId: { $in: shopIds } });
  const [locationIds, userIds] = await Promise.all([
    InventoryLocation.find({ $or: locationConditions }).distinct('_id'),
    User.find({ FullName: regex }).distinct('_id'),
  ]);
  const conditions = [{ [codeField]: regex }];
  for (const field of locationFields) conditions.push({ [field]: { $in: locationIds } });
  for (const field of userFields) conditions.push({ [field]: { $in: userIds } });
  return { $or: conditions };
};

/**
 * Đếm số dòng hàng và tổng số lượng của nhiều phiếu bằng MỘT aggregate $in.
 * Trả về Map(id phiếu → { lineCount, totalQuantity }).
 */
export const summarizeDetailLines = async ({ DetailModel, parentField, parentIds, quantityField }) => {
  if (!parentIds.length) return new Map();
  const rows = await DetailModel.aggregate([
    { $match: { [parentField]: { $in: parentIds } } },
    { $group: { _id: `$${parentField}`, lineCount: { $sum: 1 }, totalQuantity: { $sum: `$${quantityField}` } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), { lineCount: row.lineCount, totalQuantity: row.totalQuantity }]));
};

/**
 * Gắn `items` (chi tiết đầy đủ) cho danh sách phiếu cũ bằng MỘT truy vấn $in rồi gom theo phiếu.
 * `findDetails(ids)` trả về query chi tiết (đã sort + populate) cho các phiếu đó.
 */
export const attachAllDetails = async (rows, { findDetails, parentField }) => {
  if (!rows.length) return [];
  const details = await findDetails(rows.map((row) => row._id));
  const byParent = groupByField(details, parentField);
  return rows.map((row) => ({ ...toPlain(row), items: byParent.get(String(row._id)) || [] }));
};

/** Gắn `lineCount` / `totalQuantity` cho các phiếu trong một trang. */
const attachSummary = async (rows, summary) => {
  if (!summary) return rows.map(toPlain);
  const byParent = await summarizeDetailLines({ ...summary, parentIds: rows.map((row) => row._id) });
  return rows.map((row) => ({ ...toPlain(row), ...(byParent.get(String(row._id)) || { lineCount: 0, totalQuantity: 0 }) }));
};

/**
 * Chạy truy vấn danh sách phiếu.
 * - `paging.enabled = false` (request không gửi page/limit): trả mảng như API cũ, mỗi phiếu kèm `items` đầy đủ
 *   nếu có `attachDetails`.
 * - `paging.enabled = true`: trả { items, total, page, limit }, mỗi phiếu chỉ kèm `lineCount`, `totalQuantity`.
 * `decorate(query)` thêm populate / lean cho query find.
 */
export const listSlips = async ({ Model, filter, decorate, paging, sort = { createdAt: -1 }, attachDetails, summary }) => {
  if (!paging.enabled) {
    const rows = await decorate(Model.find(filter).sort(sort));
    if (!attachDetails) return rows;
    return attachAllDetails(rows, attachDetails);
  }
  const [rows, total] = await Promise.all([
    decorate(Model.find(filter).sort(sort).skip(paging.skip).limit(paging.limit)),
    Model.countDocuments(filter),
  ]);
  return pagedResult(await attachSummary(rows, summary), total, paging);
};
