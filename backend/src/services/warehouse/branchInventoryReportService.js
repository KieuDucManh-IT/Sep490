import mongoose from 'mongoose';
import { Shop } from '../../models/shop/Shop.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { getIndividualItemDetails, getInventoryReport } from './inventoryReportService.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const getManagedBranchLocation = async (user, branchId = '') => {
  if (String(user?.Role || '').toLowerCase() !== 'branch_manager') throw fail('Chỉ quản lý chi nhánh mới được xem tồn kho chi nhánh.', 403);
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
