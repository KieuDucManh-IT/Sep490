import mongoose from 'mongoose';
import { Shop } from '../../models/shop/Shop.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { getIndividualItemDetails, getInventoryReport } from './inventoryReportService.js';
import { availableOf, getBalances } from './balanceQueryService.js';

import { appError as fail } from './shared/errors.js';
import { isBranchManager } from './shared/roles.js';

const getManagedBranchLocation = async (user, branchId = '') => {
  if (!isBranchManager(user)) throw fail('Chỉ quản lý chi nhánh mới được xem tồn kho chi nhánh.', 403);
  if (branchId && !mongoose.isValidObjectId(branchId)) throw fail('Chi nhánh không hợp lệ.');
  const shopFilter = { managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } };
  if (branchId) shopFilter._id = branchId;
  const shop = await Shop.findOne(shopFilter).sort({ createdAt: 1, _id: 1 }).select('_id name code managerId').lean();
  if (!shop) throw fail('Không tìm thấy chi nhánh đang hoạt động được giao cho tài khoản này.', 403);
  const locations = await InventoryLocation.find({ shopId: shop._id, type: 'store', status: 'active' }).select('_id code name type shopId').lean();
  if (locations.length !== 1) throw fail(locations.length ? 'Chi nhánh cần có đúng một kho cửa hàng đang hoạt động.' : 'Kho cửa hàng chưa được liên kết với chi nhánh. Hãy liên kết Shop trong danh mục Kho / cửa hàng.', 409);
  return { shop, location: locations[0] };
};

export const getBranchInventoryReport = async (user, { branchId = '' } = {}) => {
  const { shop, location } = await getManagedBranchLocation(user, branchId);
  const report = await getInventoryReport({ locationId: String(location._id), storageLevel: 'shelf', itemLevel: 'variant' });
  return { ...report, branch: { _id: shop._id, name: shop.name }, location };
};

export const getBranchInventoryItemDetails = async (user, query) => {
  const { location } = await getManagedBranchLocation(user, query.branchId || '');
  return getIndividualItemDetails({ ...query, locationId: String(location._id) });
};

/**
 * Khả dụng của nhiều biến thể tại chi nhánh của quản lý chi nhánh (TASK-014 B, cột tồn của picker).
 * Một truy vấn balance `$in` qua balanceQueryService. `variantIds`: chuỗi phân cách dấu phẩy hoặc mảng, tối đa 200.
 * Trả `{ locationId, availability: { [variantId]: number } }` (biến thể không có balance → 0).
 */
export const getBranchAvailability = async (user, { branchId = '', variantIds = '' } = {}) => {
  const ids = [...new Set((Array.isArray(variantIds) ? variantIds : String(variantIds || '').split(','))
    .map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length > 200) throw fail('Tối đa 200 biến thể mỗi lần.');
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw fail('Biến thể không hợp lệ.');
  const { location } = await getManagedBranchLocation(user, branchId);
  const availability = Object.fromEntries(ids.map((id) => [id, 0]));
  const balances = ids.length ? await getBalances({ locationIds: [location._id], variantIds: ids }) : [];
  for (const row of balances) availability[String(row.variantId)] += availableOf(row);
  return { locationId: location._id, availability };
};
