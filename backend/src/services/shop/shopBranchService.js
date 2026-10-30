import mongoose from 'mongoose';
import { Shop } from '../../models/shop/Shop.js';
import { User } from '../../models/system/User.js';
import { validationError, validateObjectId } from '../../validations/shop/shopValidation.js';

/**
 * Dịch vụ nghiệp vụ quản lý chi nhánh & bổ nhiệm Quản lý chi nhánh (Shop & Branch Service)
 * Đảm bảo các bất biến nghiệp vụ cốt lõi:
 * 1. Single-HQ Invariant: Toàn bộ chuỗi của mỗi Owner chỉ có duy nhất 1 Trụ sở chính (isHQ: true).
 * 2. HQ Protection: Trụ sở chính không bao giờ được phép xóa trực tiếp.
 * 3. Minimum Network: Chuỗi phải luôn có ít nhất 1 chi nhánh hoạt động.
 * 4. Multi-branch Manager (1:N): Một Quản lý chi nhánh có thể được giao quản lý nhiều chi nhánh cùng lúc.
 * 5. Strict Role Enforcement: Chỉ tài khoản có vai trò BRANCH_MANAGER mới được phép bổ nhiệm.
 */

/**
 * Lấy danh sách hồ sơ chi nhánh có phân trang, bộ lọc và tìm kiếm đa năng
 */
export const listShopApplications = async ({
  status,
  search = '',
  ownerId,
  city = '',
  page = 1,
  limit = 10,
}) => {
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
      .sort({ isHQ: -1, createdAt: 1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Shop.countDocuments(filter),
  ]);

  return {
    data: shops,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
};

/**
 * Thống kê tổng hợp số lượng chi nhánh theo trạng thái hoạt động
 */
export const getShopStatistics = async () => {
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

  return {
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
    avgProcessingHours: '0.0',
  };
};

/**
 * Lấy chi tiết hồ sơ một chi nhánh theo ID
 */
export const getShopDetails = async (shopId) => {
  validateObjectId(shopId, 'hồ sơ gian hàng');

  const shop = await Shop.findOne({ _id: shopId, isDeleted: { $ne: true } })
    .populate('ownerId', 'FullName Email Role Status Information fullName email phone createdAt updatedAt')
    .populate('managerId', 'FullName Email Role Status Information Avatar phone')
    .lean();

  if (!shop) {
    throw validationError('Không tìm thấy hồ sơ gian hàng.', 404);
  }

  return shop;
};

/**
 * Tạm ngưng hoặc kích hoạt lại hoạt động của chi nhánh
 */
export const toggleShopSuspension = async (shopId, currentUser) => {
  validateObjectId(shopId, 'hồ sơ gian hàng');

  const shop = await Shop.findOne({ _id: shopId, isDeleted: { $ne: true } });
  if (!shop) {
    throw validationError('Không tìm thấy gian hàng.', 404);
  }

  const isOwner = currentUser && shop.ownerId && shop.ownerId.toString() === currentUser._id.toString();
  const isAdminOrOps = currentUser && ['admin', 'ADMIN', 'operation_staff', 'OPERATION_STAFF'].includes(currentUser.Role);
  if (currentUser && !isOwner && !isAdminOrOps) {
    throw validationError('Bạn không có quyền thay đổi trạng thái chi nhánh này.', 403);
  }

  if (!['ACTIVE', 'SUSPENDED'].includes(shop.status)) {
    throw validationError('Chỉ có thể tạm ngưng hoặc kích hoạt lại gian hàng đang ở trạng thái Hoạt động hoặc Tạm ngưng.', 400);
  }

  const nextStatus = shop.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  shop.status = nextStatus;

  await shop.save();

  const message =
    shop.status === 'SUSPENDED'
      ? `Gian hàng "${shop.name}" đã được chuyển sang trạng thái TẠM NGƯNG HOẠT ĐỘNG.`
      : `Gian hàng "${shop.name}" đã được KÍCH HOẠT HOẠT ĐỘNG TRỞ LẠI thành công.`;

  return {
    shopId: shop._id,
    status: shop.status,
    message,
  };
};

/**
 * Cập nhật trạng thái vòng đời của gian hàng (Dành riêng cho Admin xét duyệt)
 */
export const updateOperatingStatus = async (shopId, targetStatus) => {
  validateObjectId(shopId, 'hồ sơ gian hàng');

  const shop = await Shop.findOne({ _id: shopId, isDeleted: { $ne: true } });
  if (!shop) {
    throw validationError('Không tìm thấy gian hàng.', 404);
  }

  shop.status = targetStatus;

  // Khi gian hàng được duyệt Hoạt động (ACTIVE), tự động nâng quyền tài khoản chủ sở hữu thành SHOP_OWNER
  if (targetStatus === 'ACTIVE' && shop.ownerId) {
    const owner = await User.findById(shop.ownerId);
    if (owner && owner.Role !== 'admin' && owner.Role !== 'ADMIN') {
      owner.Role = 'SHOP_OWNER';
      await owner.save();
    }
  }

  await shop.save();

  return {
    shopId: shop._id,
    name: shop.name,
    status: shop.status,
    message: `Đã cập nhật trạng thái vận hành của gian hàng "${shop.name}" thành ${targetStatus}.`,
  };
};

/**
 * Tìm gian hàng gắn với người dùng hiện tại hoặc gian hàng mặc định của hệ thống
 */
export const resolveMyShopProfile = async ({ ownerId, managerId, branchId }) => {
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
    throw validationError('Chưa tìm thấy gian hàng / chi nhánh nào trên hệ thống.', 404);
  }

  return shop;
};

/**
 * Lấy chi nhánh được phân công cho người dùng đã xác thực
 */
export const resolveAssignedBranchForUser = async ({ userId, userRole, branchId }) => {
  if (!userId) {
    throw validationError('Chưa xác thực người dùng. Vui lòng đăng nhập lại.', 401);
  }

  let shop = null;

  // Ưu tiên 1: Chi nhánh chỉ định theo branchId nếu người dùng là Quản lý
  if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
    shop = await Shop.findOne({
      _id: branchId,
      managerId: userId,
      isDeleted: { $ne: true },
    })
      .populate('ownerId', 'FullName Email Role Status phone')
      .populate('managerId', 'FullName Email Role Status Information Avatar phone')
      .lean();
  }

  // Ưu tiên 2: Chi nhánh đầu tiên mà người dùng làm Quản lý (theo thứ tự ngày tạo từ cũ đến mới)
  if (!shop) {
    shop = await Shop.findOne({
      managerId: userId,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: 1 })
      .populate('ownerId', 'FullName Email Role Status phone')
      .populate('managerId', 'FullName Email Role Status Information Avatar phone')
      .lean();
  }

  // Ưu tiên 3: Dự phòng theo vai trò Shop Owner hoặc Admin
  if (!shop) {
    if (['shop_owner', 'owner'].includes(userRole)) {
      shop = await Shop.findOne({
        ownerId: userId,
        isHQ: true,
        isDeleted: { $ne: true },
      })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();

      if (!shop) {
        shop = await Shop.findOne({
          ownerId: userId,
          isDeleted: { $ne: true },
        })
          .sort({ isHQ: -1, createdAt: 1 })
          .populate('ownerId', 'FullName Email Role Status phone')
          .populate('managerId', 'FullName Email Role Status Information Avatar phone')
          .lean();
      }
    } else if (['admin'].includes(userRole)) {
      shop = await Shop.findOne({ isHQ: true, isDeleted: { $ne: true } })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();

      if (!shop) {
        shop = await Shop.findOne({ isDeleted: { $ne: true } })
          .sort({ isHQ: -1, createdAt: 1 })
          .populate('ownerId', 'FullName Email Role Status phone')
          .populate('managerId', 'FullName Email Role Status Information Avatar phone')
          .lean();
      }
    }
  }

  // Danh sách toàn bộ các chi nhánh được phân công cho Quản lý này (hiển thị theo thứ tự từ cũ đến mới)
  const assignedBranches = await Shop.find({
    managerId: userId,
    isDeleted: { $ne: true },
  })
    .select('_id name address city ward status isHQ imageUrl phone createdAt')
    .sort({ createdAt: 1 })
    .lean();

  return {
    shop,
    assignedBranches: assignedBranches || [],
    hasAssignment: Boolean(shop),
  };
};

/**
 * Cập nhật địa chỉ và tọa độ vị trí của chi nhánh
 */
export const updateBranchAddress = async (shopId, validatedData, currentUser) => {
  validateObjectId(shopId, 'hồ sơ gian hàng');

  const shop = await Shop.findOne({ _id: shopId, isDeleted: { $ne: true } });
  if (!shop) {
    throw validationError('Không tìm thấy gian hàng.', 404);
  }

  const isOwner = currentUser && shop.ownerId && shop.ownerId.toString() === currentUser._id.toString();
  const isManager = currentUser && shop.managerId && shop.managerId.toString() === currentUser._id.toString();
  const isAdmin = currentUser && ['admin', 'ADMIN'].includes(currentUser.Role);

  if (currentUser && !isOwner && !isManager && !isAdmin) {
    throw validationError('Bạn không có quyền chỉnh sửa địa chỉ chi nhánh này.', 403);
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

  return shop;
};

/**
 * Cập nhật thông tin chi tiết của chi nhánh và quản lý bổ nhiệm
 */
export const updateBranchInfo = async (shopId, validated, currentUser) => {
  validateObjectId(shopId, 'hồ sơ gian hàng');

  const shop = await Shop.findOne({ _id: shopId, isDeleted: { $ne: true } });
  if (!shop) {
    throw validationError('Không tìm thấy gian hàng.', 404);
  }

  const isOwner = currentUser && shop.ownerId && shop.ownerId.toString() === currentUser._id.toString();
  const isManager = currentUser && shop.managerId && shop.managerId.toString() === currentUser._id.toString();
  const isAdmin = currentUser && ['admin', 'ADMIN'].includes(currentUser.Role);

  if (currentUser && !isOwner && !isManager && !isAdmin) {
    throw validationError('Bạn không có quyền cập nhật thông tin chi nhánh này.', 403);
  }

  // Quản lý chi nhánh không được phép tự ý thay đổi Quản lý hoặc cờ Trụ sở chính
  if (isManager && !isOwner && !isAdmin) {
    if (validated.managerId !== undefined || validated.isHQ !== undefined) {
      throw validationError('Chỉ Shop Owner mới có quyền thay đổi Quản lý chi nhánh hoặc Trụ sở chính.', 403);
    }
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

  if (validated.status !== undefined) {
    if (['PENDING', 'REJECTED'].includes(shop.status)) {
      throw validationError('Không thể thay đổi trạng thái khi gian hàng đang chờ xét duyệt hoặc đã bị từ chối.', 400);
    }
    shop.status = validated.status;
  }

  // Bổ nhiệm Quản lý chi nhánh (Chỉ Owner hoặc Admin)
  if (validated.managerId !== undefined && (isOwner || isAdmin)) {
    if (!validated.managerId) {
      shop.managerId = null;
    } else {
      const mgrUser = await User.findById(validated.managerId);
      if (!mgrUser) {
        throw validationError('Không tìm thấy tài khoản Quản lý chi nhánh.', 404);
      }

      const roleStr = String(mgrUser.Role || '').trim().toLowerCase().replace(/[\s_-]/g, '');
      if (roleStr !== 'branchmanager' && roleStr !== 'brandmanager') {
        throw validationError('Chỉ có thể bổ nhiệm tài khoản có vai trò Quản lý chi nhánh (Branch Manager).', 400);
      }

      // Mô hình 1:N: Một Quản lý có thể phụ trách nhiều chi nhánh cùng lúc
      shop.managerId = mgrUser._id;
    }
  }

  // Bất biến: Duy nhất 1 Trụ sở chính (Single-HQ Invariant)
  if (validated.isHQ !== undefined && (isOwner || isAdmin)) {
    if (validated.isHQ) {
      // Khi chi nhánh này được đặt làm Trụ sở chính, hủy cờ HQ của tất cả các chi nhánh khác cùng Owner
      await Shop.updateMany(
        { _id: { $ne: shop._id }, ownerId: shop.ownerId, isHQ: true, isDeleted: { $ne: true } },
        { $set: { isHQ: false } }
      );
      shop.isHQ = true;
    } else if (shop.isHQ && !validated.isHQ) {
      const otherHQ = await Shop.findOne({
        _id: { $ne: shop._id },
        ownerId: shop.ownerId,
        isHQ: true,
        isDeleted: { $ne: true },
      });
      if (!otherHQ) {
        throw validationError('Chuỗi phải luôn có một Trụ sở chính. Hãy chỉ định chi nhánh khác làm Trụ sở chính thay vì hủy bỏ trực tiếp.', 400);
      }
      shop.isHQ = false;
    } else {
      shop.isHQ = false;
    }
  }

  await shop.save();

  await shop.populate('ownerId', 'FullName Email Role Status phone');
  await shop.populate('managerId', 'FullName Email Role Status Information Avatar phone');

  return shop;
};

/**
 * Khởi tạo một chi nhánh mới trong mạng lưới chuỗi cửa hàng
 */
export const createNewBranch = async (validated, currentUser) => {
  let resolvedOwnerId = currentUser?._id;
  const userRole = (currentUser?.Role || '').toLowerCase();

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
    throw validationError('Không tìm thấy tài khoản Shop Owner để liên kết chi nhánh.', 400);
  }

  let validManagerId = null;
  if (validated.managerId) {
    const managerUser = await User.findById(validated.managerId);
    if (!managerUser) {
      throw validationError('Không tìm thấy tài khoản Quản lý chi nhánh.', 404);
    }

    const roleStr = String(managerUser.Role || '').trim().toLowerCase().replace(/[\s_-]/g, '');
    if (roleStr !== 'branchmanager' && roleStr !== 'brandmanager') {
      throw validationError('Chỉ có thể bổ nhiệm tài khoản có vai trò Quản lý chi nhánh (Branch Manager).', 400);
    }

    validManagerId = managerUser._id;
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

  const defaultShopBanner = 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80';
  const finalBanner = validated.bannerUrl || defaultShopBanner;

  const existingBranchesCount = await Shop.countDocuments({
    ownerId: resolvedOwnerId,
    isDeleted: { $ne: true },
  });
  const resolvedIsHQ = Boolean(validated.isHQ || existingBranchesCount === 0);

  const newBranch = new Shop({
    ownerId: resolvedOwnerId,
    managerId: validManagerId,
    isHQ: resolvedIsHQ,
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

  // Bất biến: Nếu chi nhánh mới là Trụ sở chính, hủy cờ HQ của tất cả các chi nhánh cũ
  if (resolvedIsHQ) {
    await Shop.updateMany(
      { _id: { $ne: newBranch._id }, ownerId: resolvedOwnerId, isHQ: true, isDeleted: { $ne: true } },
      { $set: { isHQ: false } }
    );
  }

  await newBranch.populate('ownerId', 'FullName Email Role Status phone');
  await newBranch.populate('managerId', 'FullName Email Role Status Information Avatar phone');

  return newBranch;
};

/**
 * Xóa mềm một chi nhánh khỏi chuỗi cửa hàng
 * Đảm bảo các ràng buộc an toàn tuyệt đối:
 * - Không cho phép xóa Trụ sở chính.
 * - Chuỗi phải duy trì tối thiểu 1 chi nhánh.
 */
export const removeBranch = async (shopId, currentUser) => {
  validateObjectId(shopId, 'chi nhánh');

  const branch = await Shop.findOne({ _id: shopId, isDeleted: { $ne: true } });
  if (!branch) {
    throw validationError('Không tìm thấy chi nhánh cần xóa.', 404);
  }

  const isOwner = currentUser && branch.ownerId && branch.ownerId.toString() === currentUser._id.toString();
  const isAdmin = currentUser && ['admin', 'ADMIN'].includes(currentUser.Role);
  if (currentUser && !isOwner && !isAdmin) {
    throw validationError('Bạn không có quyền xóa chi nhánh này.', 403);
  }

  // Ràng buộc 1: Không được phép xóa Trụ sở chính
  if (branch.isHQ) {
    throw validationError('Không thể xóa Trụ sở chính của chuỗi. Hãy chỉ định chi nhánh khác làm Trụ sở chính trước khi xóa.', 400);
  }

  // Ràng buộc 2: Duy trì tối thiểu một chi nhánh trong hệ thống
  const totalBranches = await Shop.countDocuments({
    ownerId: branch.ownerId,
    isDeleted: { $ne: true },
  });
  if (totalBranches <= 1) {
    throw validationError('Chuỗi phải duy trì ít nhất một chi nhánh hoạt động. Không thể xóa toàn bộ chi nhánh.', 400);
  }

  // Xóa mềm: đánh dấu isDeleted và gỡ bỏ Quản lý chi nhánh
  branch.isDeleted = true;
  branch.deletedAt = new Date();
  branch.status = 'SUSPENDED';
  branch.managerId = null;
  await branch.save();

  return {
    deletedId: shopId,
    branchName: branch.name,
  };
};

/**
 * Lấy danh sách các tài khoản có vai trò Quản lý chi nhánh (Branch Manager) kèm số lượng chi nhánh đang phụ trách
 */
export const listEligibleBranchManagers = async () => {
  const users = await User.find(
    {
      Role: {
        $regex: /^(branch_?manager|brandmanager)$/i,
      },
      Status: { $in: ['active', 'ACTIVE'] },
    },
    'FullName Email Role Status Information Avatar createdAt'
  ).lean();

  // Bộ lọc nghiêm ngặt: Đảm bảo không tài khoản khách hàng hay vai trò nào khác lọt vào
  const validBranchManagers = (users || []).filter((u) => {
    const r = String(u?.Role || '').trim().toLowerCase().replace(/[\s_-]/g, '');
    return (r === 'branchmanager' || r === 'brandmanager') && r !== 'customer';
  });

  const managerIds = validBranchManagers.map((u) => u._id);

  // Aggregation Pipeline: Đếm số lượng chi nhánh từng quản lý đang phụ trách theo thời gian thực
  const branchCounts = await Shop.aggregate([
    {
      $match: {
        managerId: { $in: managerIds },
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: '$managerId',
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(branchCounts.map((b) => [String(b._id), b.count]));

  return validBranchManagers.map((u) => {
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
      assignedBranchesCount: countMap.get(String(u._id)) || 0,
    };
  });
};
