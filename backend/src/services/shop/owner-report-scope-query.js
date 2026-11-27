import mongoose from 'mongoose';
import { Shop } from '../../models/shop/Shop.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';

const ELIGIBLE_STATUSES = ['ACTIVE', 'SUSPENDED'];
const LOCATION_TYPES = ['store', 'warehouse'];
const idOf = (value) => mongoose.isObjectIdOrHexString(value) ? String(value).toLowerCase() : null;
const roleOf = (user) => String(user?.Role || user?.role || '').trim().toLowerCase().replace(/[\s_-]/g, '');

const scopeError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

/**
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-002
 */
function requireOwnerIdentity(user) {
  const ownerId = idOf(user?._id);
  if (!ownerId) throw scopeError(401, 'ERR_UNAUTHENTICATED', 'Bạn cần đăng nhập để xem báo cáo.');
  if (!['shopowner', 'owner'].includes(roleOf(user))) {
    throw scopeError(403, 'ERR_OWNER_REPORT_FORBIDDEN', 'Bạn không có quyền xem báo cáo chủ shop.');
  }
  return ownerId;
}

/**
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-001
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-012
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017
 */
async function readOwnedShops(ownerId, ShopModel) {
  const rows = await ShopModel.find({
    ownerId,
    isDeleted: { $ne: true },
    status: { $in: ELIGIBLE_STATUSES },
  }).select('_id ownerId name status isHQ isDeleted').sort({ _id: 1 }).lean();
  const shops = new Map();
  for (const row of rows) {
    const shopId = idOf(row._id);
    if (!shopId || idOf(row.ownerId) !== ownerId || row.isDeleted === true || !ELIGIBLE_STATUSES.includes(row.status)) continue;
    if (!shops.has(shopId)) shops.set(shopId, { shopId, name: row.name, status: row.status, isHQ: row.isHQ === true });
  }
  return shops;
}

/**
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-013
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017
 */
async function readOwnedLocations(shopById, LocationModel) {
  if (!shopById.size) return new Map();
  const rows = await LocationModel.find({
    shopId: { $in: [...shopById.keys()] },
    type: { $in: LOCATION_TYPES },
  }).select('_id shopId type').sort({ _id: 1 }).lean();
  const locations = new Map();
  for (const row of rows) {
    const locationId = idOf(row._id);
    const shopId = idOf(row.shopId);
    if (!locationId || !shopById.has(shopId) || !LOCATION_TYPES.includes(row.type)) continue;
    if (!locations.has(locationId)) locations.set(locationId, { locationId, shopId, type: row.type });
  }
  return locations;
}

/**
 * Resolve the scope for a trusted authenticated user; dependencies are internal,
 * never forwarded from transport input. Maps/IDs are internal query context;
 * the report presenter must allowlist the public response separately.
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-001
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-002
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-003
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-012
 * @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-017
 */
export async function resolveOwnerReportScope({ user } = {}, { ShopModel = Shop, LocationModel = InventoryLocation } = {}) {
  const ownerId = requireOwnerIdentity(user);
  const shopById = await readOwnedShops(ownerId, ShopModel);
  const locationById = await readOwnedLocations(shopById, LocationModel);
  const locations = [...locationById.values()];
  return {
    ownerId,
    hasBranches: shopById.size > 0,
    shops: [...shopById.values()],
    locations,
    shopById,
    locationById,
    locationIds: [...locationById.keys()],
    storeLocationIds: locations.filter((location) => location.type === 'store').map((location) => location.locationId),
    warehouseLocationIds: locations.filter((location) => location.type === 'warehouse').map((location) => location.locationId),
  };
}
