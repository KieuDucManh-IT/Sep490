import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { Shop } from '../models/Shop.js';
import {
  validateObjectId,
  validateCreateBranchInput,
  validateUpdateShopAddressInput,
  validateUpdateShopInfoInput,
  validateOperatingStatus,
  validateReverseGeocodeQuery,
} from '../validations/shopValidation.js';
import { User } from '../models/system/User.js';

/**
 * Retrieve shop applications / branches list with status filters, search, and pagination
 */
export const getShopApplications = async (req, res) => {
  try {
    const { status, search = '', ownerId, city = '', page = 1, limit = 10 } = req.query;

    const filter = { isDeleted: { $ne: true } };
    if (status) {
      const statusList = status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'].includes(s));
      if (statusList.length === 1) {
        filter.status = statusList[0];
      } else if (statusList.length > 1) {
        filter.status = { $in: statusList };
      }
    }
    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      filter.ownerId = ownerId;
    }
    if (city && city.trim() && city.trim().toUpperCase() !== 'ALL') {
      filter.city = { $regex: city.trim(), $options: 'i' };
    }

    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchedUsers = await User.find({
        $or: [
          { FullName: { $regex: escapedSearch, $options: 'i' } },
          { Email: { $regex: escapedSearch, $options: 'i' } },
        ],
      })
        .select('_id')
        .limit(100)
        .lean();
      const userIds = matchedUsers.map((u) => u._id);

      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
        { address: { $regex: escapedSearch, $options: 'i' } },
        ...(userIds.length > 0 ? [{ ownerId: { $in: userIds } }] : []),
      ];
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [shops, total] = await Promise.all([
      Shop.find(filter)
        .populate('ownerId', 'FullName Email Role Status Information fullName email createdAt updatedAt')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .sort({ isHQ: -1, createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Shop.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit) || 1,
      data: shops,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Không thể tải danh sách hồ sơ.' });
  }
};

/**
 * Retrieve statistical aggregates of shops grouped by operational status
 */
export const getShopStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [facetResult] = await Shop.aggregate([
      {
        $facet: {
          statusCounts: [
            { $match: { isDeleted: { $ne: true } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          total: [
            { $match: { isDeleted: { $ne: true } } },
            { $count: 'count' },
          ],
          newToday: [
            { $match: { status: 'PENDING', isDeleted: { $ne: true }, createdAt: { $gte: today } } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const countsMap = {};
    (facetResult?.statusCounts || []).forEach((item) => {
      if (item._id) countsMap[item._id] = item.count;
    });

    const pending = countsMap.PENDING || 0;
    const active = countsMap.ACTIVE || 0;
    const rejected = countsMap.REJECTED || 0;
    const suspended = countsMap.SUSPENDED || 0;
    const total = facetResult?.total?.[0]?.count || 0;
    const newToday = facetResult?.newToday?.[0]?.count || 0;

    const reviewed = active + rejected + suspended;
    const approvalRate = reviewed > 0 ? (((active + suspended) / reviewed) * 100).toFixed(1) : '0.0';
    const avgProcessingHours = '0.0';

    return res.json({
      success: true,
      counts: {
        ALL: total,
        PENDING: pending,
        ACTIVE: active,
        SUSPENDED: suspended,
        REJECTED: rejected,
      },
      totalShops: total,
      newToday,
      approvalRate,
      avgProcessingHours,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Không thể lấy số liệu thống kê.' });
  }
};

/**
 * Retrieve detailed shop profile by identifier
 */
export const getShopById = async (req, res) => {
  try {
    validateObjectId(req.params.id, 'hồ sơ gian hàng');

    const shop = await Shop.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate('ownerId', 'FullName Email Role Status Information fullName email phone createdAt updatedAt')
      .populate('managerId', 'FullName Email Role Status Information Avatar phone')
      .lean();

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ gian hàng.' });
    }

    return res.json({ success: true, data: shop });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Không thể xem chi tiết gian hàng.' });
  }
};

/**
 * Suspend or reactivate a showroom / branch
 */
export const toggleSuspendShop = async (req, res) => {
  try {
    validateObjectId(req.params.id, 'hồ sơ gian hàng');

    const shop = await Shop.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.' });
    }

    const isOwner = req.user && shop.ownerId && shop.ownerId.toString() === req.user._id.toString();
    const isAdminOrOps = req.user && ['admin', 'ADMIN', 'operation_staff', 'OPERATION_STAFF'].includes(req.user.Role);
    if (req.user && !isOwner && !isAdminOrOps) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thay đổi trạng thái chi nhánh này.',
      });
    }

    if (!['ACTIVE', 'SUSPENDED'].includes(shop.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể tạm ngưng hoặc kích hoạt lại gian hàng đang ở trạng thái Hoạt động hoặc Tạm ngưng.',
      });
    }

    const nextStatus = shop.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    shop.status = nextStatus;

    await shop.save();

    return res.json({
      success: true,
      message:
        shop.status === 'SUSPENDED'
          ? `Gian hàng "${shop.name}" đã được chuyển sang trạng thái TẠM NGƯNG HOẠT ĐỘNG.`
          : `Gian hàng "${shop.name}" đã được KÍCH HOẠT HOẠT ĐỘNG TRỞ LẠI thành công.`,
      data: {
        shopId: shop._id,
        status: shop.status,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || 'Có lỗi xảy ra khi thay đổi trạng thái gian hàng.' });
  }
};

/**
 * Update shop operating lifecycle status (ACTIVE, SUSPENDED, PENDING, REJECTED)
 */
export const updateShopOperatingStatus = async (req, res) => {
  try {
    validateObjectId(req.params.id, 'hồ sơ gian hàng');
    const targetStatus = validateOperatingStatus(req.body.status);

    const shop = await Shop.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.' });
    }

    shop.status = targetStatus;

    if (targetStatus === 'ACTIVE' && shop.ownerId) {
      const owner = await User.findById(shop.ownerId);
      if (owner && owner.Role !== 'admin' && owner.Role !== 'ADMIN') {
        owner.Role = 'SHOP_OWNER';
        await owner.save();
      }
    }

    await shop.save();

    return res.json({
      success: true,
      message: `Đã cập nhật trạng thái vận hành của gian hàng "${shop.name}" thành ${targetStatus}.`,
      data: {
        shopId: shop._id,
        name: shop.name,
        status: shop.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Có lỗi xảy ra khi cập nhật trạng thái vận hành.' });
  }
};

/**
 * Retrieve shop profile associated with current user or fallback HQ
 */
export const getMyShop = async (req, res) => {
  try {
    const { ownerId, managerId, branchId } = req.query;
    let shop = null;

    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      shop = await Shop.findOne({ _id: branchId, isDeleted: { $ne: true } })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    } else if (managerId && mongoose.Types.ObjectId.isValid(managerId)) {
      shop = await Shop.findOne({
        managerId,
        status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
        isDeleted: { $ne: true },
      })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    } else if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      shop = await Shop.findOne({
        managerId: ownerId,
        status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
        isDeleted: { $ne: true },
      })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();

      if (!shop) {
        shop = await Shop.findOne({
          ownerId,
          isHQ: true,
          status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
          isDeleted: { $ne: true },
        })
          .populate('ownerId', 'FullName Email Role Status phone')
          .populate('managerId', 'FullName Email Role Status Information Avatar phone')
          .lean();
      }

      if (!shop) {
        shop = await Shop.findOne({
          ownerId,
          status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
          isDeleted: { $ne: true },
        })
          .sort({ createdAt: 1 })
          .populate('ownerId', 'FullName Email Role Status phone')
          .populate('managerId', 'FullName Email Role Status Information Avatar phone')
          .lean();
      }
    }

    if (!shop) {
      shop = await Shop.findOne({ isHQ: true, status: 'ACTIVE', isDeleted: { $ne: true } })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    }
    if (!shop) {
      shop = await Shop.findOne({ status: 'ACTIVE', isDeleted: { $ne: true } })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    }
    if (!shop) {
      shop = await Shop.findOne({ isDeleted: { $ne: true } })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    }

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Chưa tìm thấy gian hàng / chi nhánh nào trên hệ thống.',
      });
    }

    return res.json({
      success: true,
      data: shop,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi tải thông tin gian hàng.',
    });
  }
};

/**
 * Update showroom address details and GPS coordinates
 */
export const updateShopAddress = async (req, res) => {
  try {
    const { id } = req.params;
    validateObjectId(id, 'hồ sơ gian hàng');
    const validatedData = validateUpdateShopAddressInput(req.body);

    const shop = await Shop.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gian hàng.',
      });
    }

    const isOwner = req.user && shop.ownerId && shop.ownerId.toString() === req.user._id.toString();
    const isManager = req.user && shop.managerId && shop.managerId.toString() === req.user._id.toString();
    const isAdmin = req.user && ['admin', 'ADMIN'].includes(req.user.Role);
    if (req.user && !isOwner && !isManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa địa chỉ chi nhánh này.',
      });
    }

    shop.address = validatedData.address;
    shop.city = validatedData.city;
    shop.ward = validatedData.ward;
    shop.latitude = validatedData.latitude;
    shop.longitude = validatedData.longitude;

    if (validatedData.phone) {
      shop.phone = validatedData.phone;
    }

    await shop.save();
    await shop.populate('ownerId', 'FullName Email Role Status phone');

    return res.json({
      success: true,
      message: 'Cập nhật địa chỉ và tọa độ GPS gian hàng thành công.',
      data: shop,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi khi cập nhật địa chỉ gian hàng.',
    });
  }
};

/**
 * Update comprehensive showroom / branch information
 */
export const updateShopInfo = async (req, res) => {
  try {
    const { id } = req.params;
    validateObjectId(id, 'hồ sơ gian hàng');
    const validated = validateUpdateShopInfoInput(req.body);

    const shop = await Shop.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gian hàng.',
      });
    }

    const previousManagerId = shop.managerId ? shop.managerId.toString() : null;

    const isOwner = req.user && shop.ownerId && shop.ownerId.toString() === req.user._id.toString();
    const isManager = req.user && shop.managerId && shop.managerId.toString() === req.user._id.toString();
    const isAdmin = req.user && ['admin', 'ADMIN'].includes(req.user.Role);
    if (req.user && !isOwner && !isManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật thông tin chi nhánh này.',
      });
    }

    if (validated.name !== undefined) shop.name = validated.name;
    if (validated.description !== undefined) shop.description = validated.description;
    if (validated.phone !== undefined) shop.phone = validated.phone;
    if (validated.address !== undefined) shop.address = validated.address;
    if (validated.city !== undefined) shop.city = validated.city;
    if (validated.ward !== undefined) shop.ward = validated.ward;
    if (validated.latitude !== undefined) shop.latitude = validated.latitude;
    if (validated.longitude !== undefined) shop.longitude = validated.longitude;
    if (validated.imageUrl !== undefined) shop.imageUrl = validated.imageUrl;
    if (validated.bannerUrl !== undefined) shop.bannerUrl = validated.bannerUrl;
    if (validated.openingHours !== undefined) shop.openingHours = validated.openingHours;
    if (validated.status !== undefined) shop.status = validated.status;

    if (validated.managerId !== undefined && (isOwner || isAdmin)) {
      if (!validated.managerId) {
        shop.managerId = null;
      } else {
        const mgrUser = await User.findById(validated.managerId);
        if (mgrUser) {
          shop.managerId = mgrUser._id;
          if (['customer', 'CUSTOMER'].includes(mgrUser.Role)) {
            mgrUser.Role = 'BRANCH_MANAGER';
            await mgrUser.save();
          }
        }
      }
    }

    if (validated.isHQ !== undefined && (isOwner || isAdmin)) {
      if (validated.isHQ) {
        await Shop.updateMany(
          { _id: { $ne: shop._id }, ownerId: shop.ownerId, isHQ: true, isDeleted: { $ne: true } },
          { $set: { isHQ: false } }
        );
        shop.isHQ = true;
      } else {
        shop.isHQ = false;
      }
    }

    await shop.save();

    if (previousManagerId) {
      const currentManagerId = shop.managerId ? shop.managerId.toString() : null;
      if (previousManagerId !== currentManagerId) {
        await checkAndDemoteBranchManager(previousManagerId);
      }
    }

    await shop.populate('ownerId', 'FullName Email Role Status phone');
    await shop.populate('managerId', 'FullName Email Role Status Information Avatar phone');

    return res.json({
      success: true,
      message: 'Cập nhật thông tin gian hàng và địa chỉ thành công.',
      data: shop,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi khi cập nhật thông tin gian hàng.',
    });
  }
};

/**
 * Demote user to CUSTOMER if they no longer manage any active branches
 */
export const checkAndDemoteBranchManager = async (managerId) => {
  try {
    if (!managerId || !mongoose.Types.ObjectId.isValid(managerId)) return;

    const remainingCount = await Shop.countDocuments({
      managerId: managerId,
      isDeleted: { $ne: true },
    });

    if (remainingCount === 0) {
      const user = await User.findById(managerId);
      if (user && ['branch_manager', 'BRANCH_MANAGER'].includes(user.Role)) {
        user.Role = 'CUSTOMER';
        await user.save();
      }
    }
  } catch (err) {
    console.error('Lỗi khi kiểm tra và hạ cấp Branch Manager:', err);
  }
};

/**
 * Create a new showroom branch in the brand network
 */
export const createBranch = async (req, res) => {
  try {
    const validated = validateCreateBranchInput(req.body);

    let resolvedOwnerId = req.user?._id;
    const userRole = (req.user?.Role || '').toLowerCase();
    if (['admin'].includes(userRole) && validated.ownerId) {
      resolvedOwnerId = validated.ownerId;
    }
    if (!resolvedOwnerId) {
      if (validated.ownerId) {
        resolvedOwnerId = validated.ownerId;
      } else {
        const shopOwner = await User.findOne({ Role: { $in: ['SHOP_OWNER', 'shop_owner', 'OWNER', 'owner'] } });
        if (shopOwner) resolvedOwnerId = shopOwner._id;
      }
    }

    if (!resolvedOwnerId) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy tài khoản Shop Owner để liên kết chi nhánh.',
      });
    }

    let validManagerId = null;
    if (validated.managerId) {
      const managerUser = await User.findById(validated.managerId);
      if (managerUser) {
        validManagerId = managerUser._id;
        if (['customer', 'CUSTOMER'].includes(managerUser.Role)) {
          managerUser.Role = 'BRANCH_MANAGER';
          await managerUser.save();
        }
      }
    }

    let finalImageUrl = validated.imageUrl;
    if (!finalImageUrl && resolvedOwnerId) {
      const ownerUser = await User.findById(resolvedOwnerId).select('Avatar').lean();
      if (ownerUser?.Avatar && typeof ownerUser.Avatar === 'string' && ownerUser.Avatar.trim()) {
        finalImageUrl = ownerUser.Avatar.trim();
      } else {
        finalImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(validated.name)}&background=0F172A&color=D97706&size=200`;
      }
    }

    const defaultShowroomBanner = 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80';
    const finalBanner = validated.bannerUrl || defaultShowroomBanner;

    const newBranch = new Shop({
      ownerId: resolvedOwnerId,
      managerId: validManagerId,
      isHQ: validated.isHQ,
      name: validated.name,
      description: validated.description,
      phone: validated.phone,
      address: validated.address,
      city: validated.city,
      ward: validated.ward,
      latitude: validated.latitude,
      longitude: validated.longitude,
      imageUrl: finalImageUrl,
      bannerUrl: finalBanner,
      openingHours: validated.openingHours,
      status: 'ACTIVE',
    });

    await newBranch.save();

    if (validated.isHQ) {
      await Shop.updateMany(
        { _id: { $ne: newBranch._id }, ownerId: resolvedOwnerId, isHQ: true, isDeleted: { $ne: true } },
        { $set: { isHQ: false } }
      );
    }
    await newBranch.populate('ownerId', 'FullName Email Role Status phone');
    await newBranch.populate('managerId', 'FullName Email Role Status Information Avatar phone');

    return res.status(201).json({
      success: true,
      message: `Khởi tạo chi nhánh "${newBranch.name}" thành công.`,
      data: newBranch,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi khi khởi tạo chi nhánh mới.',
    });
  }
};

/**
 * Soft-delete a showroom branch from the brand network
 */
export const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    validateObjectId(id, 'chi nhánh');

    const branch = await Shop.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chi nhánh cần xóa.',
      });
    }

    const isOwner = req.user && branch.ownerId && branch.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user && ['admin', 'ADMIN'].includes(req.user.Role);
    if (req.user && !isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa chi nhánh này.',
      });
    }

    if (branch.isHQ) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa Trụ sở chính (HQ) của chuỗi. Hãy chỉ định chi nhánh khác làm HQ trước khi xóa.',
      });
    }

    const totalBranches = await Shop.countDocuments({
      ownerId: branch.ownerId,
      isDeleted: { $ne: true },
    });
    if (totalBranches <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Chuỗi phải duy trì ít nhất một chi nhánh hoạt động. Không thể xóa toàn bộ chi nhánh.',
      });
    }

    const managerToDemote = branch.managerId ? branch.managerId.toString() : null;
    branch.isDeleted = true;
    branch.deletedAt = new Date();
    branch.status = 'SUSPENDED';
    branch.managerId = null;
    await branch.save();

    if (managerToDemote) {
      await checkAndDemoteBranchManager(managerToDemote);
    }

    return res.json({
      success: true,
      message: `Đã xóa chi nhánh "${branch.name}" khỏi hệ thống thành công.`,
      deletedId: id,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi khi xóa chi nhánh.',
    });
  }
};

/**
 * Retrieve eligible accounts for Branch Manager appointment
 */
export const getBranchManagers = async (req, res) => {
  try {
    const users = await User.find(
      {
        Role: {
          $in: [
            'branch_manager',
            'BRANCH_MANAGER',
            'brandmanager',
            'BRANDMANAGER',
            'customer',
            'CUSTOMER',
            'warehouse_manager',
            'WAREHOUSE_MANAGER',
          ],
        },
        Status: { $in: ['active', 'ACTIVE'] },
      },
      'FullName Email Role Status Information Avatar createdAt'
    ).lean();

    const mapped = users.map((u) => {
      let phone = '';
      if (Array.isArray(u.Information) && u.Information.length > 0) {
        phone = u.Information[0]?.Phone || '';
      }
      return {
        _id: u._id,
        FullName: u.FullName,
        Email: u.Email,
        Role: u.Role,
        Status: u.Status,
        Avatar: u.Avatar || '',
        phone,
      };
    });

    return res.json({
      success: true,
      data: mapped,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi lấy danh sách quản lý chi nhánh.',
    });
  }
};

const GEO_CACHE = new Map();
const MAX_GEO_CACHE_SIZE = 500;
const GEO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const getCachedGeo = (lat, lng) => {
  const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  const entry = GEO_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > GEO_CACHE_TTL_MS) {
    GEO_CACHE.delete(key);
    return null;
  }
  return entry.data;
};

const setCachedGeo = (lat, lng, data) => {
  const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  if (GEO_CACHE.size >= MAX_GEO_CACHE_SIZE) {
    const oldestKey = GEO_CACHE.keys().next().value;
    if (oldestKey) GEO_CACHE.delete(oldestKey);
  }
  GEO_CACHE.set(key, { data, timestamp: Date.now() });
};

/**
 * Reverse geocode GPS coordinates to administrative division names
 */
export const reverseGeocodeAddress = async (req, res) => {
  try {
    const { targetLat, targetLng } = validateReverseGeocodeQuery(req.query);

    const cachedData = getCachedGeo(targetLat, targetLng);
    if (cachedData) {
      return res.json({
        success: true,
        source: 'cache',
        data: {
          ...cachedData,
          latitude: targetLat,
          longitude: targetLng,
        },
      });
    }

    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${targetLat}&longitude=${targetLng}&localityLanguage=vi`;
      const bdcRes = await fetch(bdcUrl, { signal: AbortSignal.timeout(3500) });
      if (bdcRes.ok) {
        const d = await bdcRes.json();
        const city = d.principalSubdivision || d.city || '';
        const ward = d.locality || '';
        if (city) {
          const payload = {
            latitude: targetLat,
            longitude: targetLng,
            city,
            ward,
            district: d.locality || '',
            country: d.countryName || 'Việt Nam',
          };
          setCachedGeo(targetLat, targetLng, payload);
          return res.json({
            success: true,
            source: 'bigdatacloud',
            data: payload,
          });
        }
      }
    } catch (_) {}

    try {
      const photonUrl = `https://photon.komoot.io/reverse?lat=${targetLat}&lon=${targetLng}`;
      const photonRes = await fetch(photonUrl, { signal: AbortSignal.timeout(3500) });
      if (photonRes.ok) {
        const pData = await photonRes.json();
        const prop = pData?.features?.[0]?.properties;
        if (prop) {
          const city = prop.city || prop.state || prop.county || '';
          const ward = prop.district || prop.locality || prop.name || '';
          const street = [prop.housenumber, prop.street].filter(Boolean).join(' ');
          if (city) {
            const payload = {
              latitude: targetLat,
              longitude: targetLng,
              city,
              ward,
              district: prop.district || '',
              street,
              country: prop.country || 'Việt Nam',
            };
            setCachedGeo(targetLat, targetLng, payload);
            return res.json({
              success: true,
              source: 'photon',
              data: payload,
            });
          }
        }
      }
    } catch (_) {}

    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${targetLat}&lon=${targetLng}&format=json&accept-language=vi`;
      const nomRes = await fetch(nominatimUrl, {
        signal: AbortSignal.timeout(3500),
        headers: {
          'User-Agent': 'Vestora-Platform/1.0 (contact: admin@vestora.vn)',
          Accept: 'application/json',
        },
      });
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const addr = nomData?.address;
        if (addr) {
          const city = addr.city || addr.state || addr.province || addr.county || '';
          const ward = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || '';
          const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
          const payload = {
            latitude: targetLat,
            longitude: targetLng,
            city,
            ward,
            district: addr.city_district || addr.district || '',
            street,
            country: addr.country || 'Việt Nam',
          };
          setCachedGeo(targetLat, targetLng, payload);
          return res.json({
            success: true,
            source: 'nominatim',
            data: payload,
          });
        }
      }
    } catch (_) {}

    return res.json({
      success: true,
      source: 'fallback',
      data: {
        latitude: targetLat,
        longitude: targetLng,
        city: '',
        ward: '',
        district: '',
        street: '',
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Lỗi khi giải mã tọa độ địa chỉ GPS.',
    });
  }
};

/**
 * Upload and process showroom logo or banner image with Cloudinary and local fallback
 */
export const uploadShopImage = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WEBP).',
      });
    }

    if (file.buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'Dung lượng ảnh vượt quá giới hạn 10MB.',
      });
    }

    const imageType = req.body?.type === 'banner' ? 'banner' : 'avatar';

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (cloudName && apiKey && apiSecret) {
      try {
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

        let processedBuffer = file.buffer;
        try {
          if (imageType === 'avatar') {
            processedBuffer = await sharp(file.buffer).rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
          } else {
            processedBuffer = await sharp(file.buffer).rotate().resize(1920, 1080, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
          }
        } catch {
          processedBuffer = file.buffer;
        }

        const b64 = Buffer.from(processedBuffer).toString('base64');
        const dataUri = `data:image/webp;base64,${b64}`;
        const uploadRes = await cloudinary.uploader.upload(dataUri, {
          folder: `vestora/shops/${imageType}`,
          public_id: `${Date.now()}-${crypto.randomUUID()}`,
          resource_type: 'image',
        });

        return res.status(200).json({
          success: true,
          url: uploadRes.secure_url,
          message: 'Tải ảnh lên Cloudinary thành công!',
        });
      } catch (cloudErr) {
        console.warn('Cloudinary upload warning, falling back to local static storage:', cloudErr.message);
      }
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'shops');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const filename = `${imageType}-${uniqueId}.webp`;
    const filepath = path.join(uploadsDir, filename);

    let processedBuffer;
    try {
      if (imageType === 'avatar') {
        processedBuffer = await sharp(file.buffer).rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
      } else {
        processedBuffer = await sharp(file.buffer).rotate().resize(1920, 1080, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      }
    } catch {
      processedBuffer = file.buffer;
    }

    fs.writeFileSync(filepath, processedBuffer);

    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const fileUrl = `${protocol}://${host}/uploads/shops/${filename}`;

    return res.status(200).json({
      success: true,
      url: fileUrl,
      message: 'Tải ảnh từ thiết bị thành công!',
    });
  } catch (error) {
    next(error);
  }
};



