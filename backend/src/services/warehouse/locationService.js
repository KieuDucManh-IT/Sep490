import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { validateInventoryLocation, validateStorageLocation } from '../../validations/warehouse/locationValidation.js';
import User from '../../models/system/User.js';
import { Shop } from '../../models/shop/Shop.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { getCentralWarehouse } from './shared/locations.js';
import { isAdmin } from './shared/roles.js';
import { appError } from './shared/errors.js';
import { assertWarehouseCapacity, pickCentralWarehouseChanges } from './locationRules.js';

const capacityConflict = (message) => Object.assign(new Error(message), { statusCode: 409 });
const capacityOf = (value) => Number.isInteger(value) && value >= 0 ? value : 0;
const childCapacityTotal = async (filter) => {
  const children = await StorageLocation.find(filter).select('maxCapacity').lean();
  return children.reduce((total, child) => total + capacityOf(child.maxCapacity), 0);
};

/** Số đang chứa của một kho = tổng quantityOnHand trên balance (cùng cách tính "đã dùng" của capacitySnapshot). */
const onHandTotal = async (locationId) => {
  const [row] = await InventoryBalance.aggregate([
    { $match: { locationId } },
    { $group: { _id: null, total: { $sum: '$quantityOnHand' } } },
  ]);
  return Math.max(0, Number(row?.total) || 0);
};

/** Kho tổng kèm số đang chứa — dữ liệu cho màn "Thiết lập kho tổng". */
export const getCentralWarehouseSettings = async () => {
  const central = await getCentralWarehouse(null, { select: 'code name type address maxCapacity note status' });
  return { ...central, currentQuantity: await onHandTotal(central._id) };
};

export const inventoryLocationService = {
  list: () => InventoryLocation.find().sort({ createdAt: -1 }).populate('managerId', 'FullName Email Role').populate('shopId', 'name status isDeleted'),
  create: async (payload) => {
    const data = validateInventoryLocation(payload);
    await validateWarehouseManager(data.managerId);
    await validateShopLink(data);
    if (data.type === 'warehouse') data.shopId = null;
    return InventoryLocation.create(data);
  },
  /**
   * Quản lý kho chỉ sửa được kho tổng (tên, địa chỉ, sức chứa, ghi chú); admin sửa được mọi kho như trước.
   * Sức chứa kho tổng không được nhỏ hơn số đang chứa.
   */
  update: async (id, payload, user = null) => {
    const location = await InventoryLocation.findById(id);
    if (!location) return null;
    const managerOnly = user && !isAdmin(user);
    if (managerOnly && location.type !== 'warehouse') {
      throw appError('Quản lý kho chỉ được sửa thông tin kho tổng. Kho chi nhánh do quản trị viên quản lý.', 403);
    }
    const input = managerOnly ? pickCentralWarehouseChanges(payload) : payload;
    const changes = validateInventoryLocation(input, location.toObject());
    await validateWarehouseManager(Object.hasOwn(changes, 'managerId') ? changes.managerId : location.managerId);
    const candidate = { ...location.toObject(), ...changes };
    await validateShopLink(candidate, location._id);
    if (candidate.type === 'warehouse') changes.shopId = null;
    const childrenCapacity = await childCapacityTotal({ locationId: location._id, parentStorageId: null });
    const nextCapacity = Object.hasOwn(changes, 'maxCapacity') ? changes.maxCapacity : location.maxCapacity;
    if (candidate.type === 'warehouse' && (managerOnly || Object.hasOwn(changes, 'maxCapacity'))) {
      assertWarehouseCapacity({ maxCapacity: nextCapacity, currentQuantity: await onHandTotal(location._id), childrenCapacity });
    } else if (childrenCapacity > capacityOf(nextCapacity)) {
      throw capacityConflict(`Sức chứa tối đa phải từ ${childrenCapacity} cái trở lên để chứa các khu hiện có.`);
    }
    Object.assign(location, changes);
    return location.save();
  },
  remove: async (id) => {
    if (await StorageLocation.exists({ locationId: id })) throw capacityConflict('Không thể xóa kho/cửa hàng khi vẫn còn vị trí lưu trữ bên trong.');
    return InventoryLocation.findByIdAndDelete(id);
  },
};

const validateShopLink = async (candidate, currentId = null) => {
  if (candidate.type === 'warehouse') return;
  if (!candidate.shopId) throw Object.assign(new Error('Kho cửa hàng phải được liên kết với một chi nhánh.'), { statusCode: 400 });
  const shop = await Shop.findOne({ _id: candidate.shopId, status: 'ACTIVE', isDeleted: { $ne: true } }).select('_id');
  if (!shop) throw Object.assign(new Error('Chi nhánh liên kết không tồn tại hoặc không hoạt động.'), { statusCode: 400 });
  if ((candidate.status || 'active') === 'active') {
    const duplicateFilter = { shopId: shop._id, type: 'store', status: 'active' };
    if (currentId) duplicateFilter._id = { $ne: currentId };
    if (await InventoryLocation.exists(duplicateFilter)) throw Object.assign(new Error('Chi nhánh này đã có một kho cửa hàng đang hoạt động.'), { statusCode: 409 });
  }
};

const validateWarehouseManager = async (managerId) => {
  if (!managerId) return;
  const manager = await User.findOne({ _id: managerId, Role: /^warehouse_manager$/i, Status: /^active$/i }).select('_id');
  if (!manager) throw Object.assign(new Error('Người quản lý phải là tài khoản warehouse manager đang hoạt động.'), { statusCode: 400 });
};

const listStorageLocations = () => StorageLocation.find().sort({ createdAt: -1 }).populate('locationId parentStorageId');
const validateParentAndCapacity = async (candidate, currentId = null) => {
  let parent;
  if (candidate.parentStorageId) {
    parent = await StorageLocation.findById(candidate.parentStorageId);
    if (!parent) throw Object.assign(new Error('Không tìm thấy vị trí cha.'), { statusCode: 400 });
    const validParentType = (candidate.type === 'row' && parent.type === 'zone') || (candidate.type === 'shelf' && parent.type === 'row');
    if (!validParentType) throw Object.assign(new Error('Cấu trúc hợp lệ là Khu → Dãy → Kệ.'), { statusCode: 400 });
    if (String(parent.locationId) !== String(candidate.locationId)) throw Object.assign(new Error('Vị trí cha phải thuộc cùng kho/cửa hàng.'), { statusCode: 400 });
    if (!candidate.code.startsWith(`${parent.code}-`)) throw Object.assign(new Error(`Mã vị trí phải bắt đầu bằng ${parent.code}-.`), { statusCode: 400 });
  } else if (!['zone', 'temporary_area'].includes(candidate.type)) {
    throw Object.assign(new Error('Dãy và kệ phải có vị trí cha.'), { statusCode: 400 });
  }

  const childrenFilter = { parentStorageId: currentId || candidate._id };
  const children = candidate._id ? await StorageLocation.find(childrenFilter).select('type code maxCapacity locationId').lean() : [];
  const expectedChildType = candidate.type === 'zone' ? 'row' : candidate.type === 'row' ? 'shelf' : null;
  if (children.some((child) => child.type !== expectedChildType)) {
    throw Object.assign(new Error('Không thể đổi loại vị trí khi cấu trúc con không còn phù hợp.'), { statusCode: 409 });
  }
  if (children.some((child) => !child.code.startsWith(`${candidate.code}-`))) {
    throw Object.assign(new Error('Mã vị trí cha không thể đổi khi mã con chưa được cập nhật theo tiền tố mới.'), { statusCode: 409 });
  }
  if (children.some((child) => String(child.locationId) !== String(candidate.locationId))) {
    throw Object.assign(new Error('Không thể chuyển vị trí cha sang kho/cửa hàng khác khi chưa chuyển các vị trí con.'), { statusCode: 409 });
  }
  const childrenCapacity = children.reduce((total, child) => total + capacityOf(child.maxCapacity), 0);
  if (childrenCapacity > capacityOf(candidate.maxCapacity)) {
    throw capacityConflict(`Sức chứa của cha không được thấp hơn tổng sức chứa con (${childrenCapacity} cái).`);
  }

  if (parent) {
    const siblingFilter = { parentStorageId: parent._id, _id: { $ne: currentId } };
    const siblingsCapacity = await childCapacityTotal(siblingFilter);
    if (siblingsCapacity + capacityOf(candidate.maxCapacity) > capacityOf(parent.maxCapacity)) {
      throw capacityConflict(`Sức chứa còn lại của cha là ${Math.max(0, parent.maxCapacity - siblingsCapacity)} cái.`);
    }
  } else if (!parent && ['zone', 'temporary_area'].includes(candidate.type)) {
    const location = await InventoryLocation.findById(candidate.locationId);
    if (!location) throw Object.assign(new Error('Không tìm thấy kho/cửa hàng.'), { statusCode: 400 });
    const siblingFilter = { locationId: location._id, parentStorageId: null, _id: { $ne: currentId } };
    const siblingsCapacity = await childCapacityTotal(siblingFilter);
    if (siblingsCapacity + capacityOf(candidate.maxCapacity) > capacityOf(location.maxCapacity)) {
      throw capacityConflict(`Sức chứa còn lại của kho/cửa hàng là ${Math.max(0, location.maxCapacity - siblingsCapacity)} cái.`);
    }
  }
};

export const storageLocationService = {
  list: listStorageLocations,
  // Vị trí lưu trữ chỉ thuộc kho tổng (TASK-014 A2): luôn gán locationId = kho tổng, bỏ qua giá trị client gửi.
  create: async (payload) => {
    const central = await getCentralWarehouse(null, { select: '_id' });
    const data = validateStorageLocation({ ...(payload || {}), locationId: String(central._id) });
    await validateParentAndCapacity(data);
    return StorageLocation.create(data);
  },
  update: async (id, payload) => {
    const location = await StorageLocation.findById(id);
    if (!location) return null;
    const central = await getCentralWarehouse(null, { select: '_id' });
    if (String(location.locationId) !== String(central._id)) {
      throw appError('Vị trí này không thuộc kho tổng nên không sửa được ở đây.', 409);
    }
    const changes = validateStorageLocation({ ...(payload || {}), locationId: String(central._id) }, location.toObject());
    const candidate = { ...location.toObject(), ...changes, _id: location._id };
    if (candidate.parentStorageId && String(candidate.parentStorageId) === String(location._id)) {
      throw Object.assign(new Error('Vị trí không thể là cha của chính nó.'), { statusCode: 400 });
    }
    await validateParentAndCapacity(candidate, location._id);
    Object.assign(location, changes);
    return location.save();
  },
  remove: async (id) => {
    if (await StorageLocation.exists({ parentStorageId: id })) throw capacityConflict('Hãy xóa các dãy/kệ bên trong trước khi xóa vị trí này.');
    return StorageLocation.findByIdAndDelete(id);
  },
};
