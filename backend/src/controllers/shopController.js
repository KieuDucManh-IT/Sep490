import mongoose from 'mongoose';
import { Shop } from '../models/Shop.js';
import { User } from '../models/User.js';

// UC-12: Manage Shop Information, Branches and Warehouses
export const getShopApplications = async (req, res) => {
  try {
    const { status, search = '', ownerId, city = '', page = 1, limit = 10 } = req.query;

    const filter = {};
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
        .populate('reviewedBy', 'FullName Email fullName email')
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

export const getShopStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [facetResult] = await Shop.aggregate([
      {
        $facet: {
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          total: [
            { $count: 'count' },
          ],
          newToday: [
            { $match: { status: 'PENDING', createdAt: { $gte: today } } },
            { $count: 'count' },
          ],
          avgProcessing: [
            { $match: { status: { $in: ['ACTIVE', 'REJECTED', 'SUSPENDED'] }, reviewedAt: { $ne: null } } },
            {
              $project: {
                diffHours: {
                  $divide: [{ $subtract: ['$reviewedAt', '$createdAt'] }, 3600000],
                },
              },
            },
            { $match: { diffHours: { $gt: 0 } } },
            { $group: { _id: null, avgHours: { $avg: '$diffHours' } } },
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
    const rawAvg = facetResult?.avgProcessing?.[0]?.avgHours || 0;

    const reviewed = active + rejected + suspended;
    const approvalRate = reviewed > 0 ? (((active + suspended) / reviewed) * 100).toFixed(1) : '0.0';
    const avgProcessingHours = rawAvg > 0 ? (rawAvg < 0.1 ? '0.1' : rawAvg.toFixed(1)) : '0.0';

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

export const getShopById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã hồ sơ gian hàng không hợp lệ.' });
    }

    const shop = await Shop.findById(req.params.id)
      .populate('ownerId', 'FullName Email Role Status Information fullName email phone createdAt updatedAt')
      .populate('managerId', 'FullName Email Role Status Information Avatar phone')
      .populate('reviewedBy', 'FullName Email fullName email')
      .lean();

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ gian hàng.' });
    }

    return res.json({ success: true, data: shop });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Không thể xem chi tiết gian hàng.' });
  }
};



export const toggleSuspendShop = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã hồ sơ gian hàng không hợp lệ.' });
    }

    const { adminId, reason = '', notes = '' } = req.body;
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.' });
    }

    if (!['ACTIVE', 'SUSPENDED'].includes(shop.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể tạm ngưng hoặc kích hoạt lại gian hàng đang ở trạng thái Hoạt động hoặc Tạm ngưng.',
      });
    }

    const nextStatus = shop.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    shop.status = nextStatus;
    shop.reviewedBy = (adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : null;
    shop.reviewedAt = new Date();

    if (nextStatus === 'SUSPENDED') {
      const suspendReason = reason?.trim() || 'Tạm ngưng hoạt động theo quyết định của Bộ phận Vận hành (Operations Staff).';
      shop.rejectionReason = suspendReason.slice(0, 500);
      if (notes?.trim()) {
        shop.notes = notes.trim().slice(0, 500);
      }
    } else {
      shop.rejectionReason = '';
      if (notes?.trim()) {
        shop.notes = notes.trim().slice(0, 500);
      }
    }

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
        rejectionReason: shop.rejectionReason,
        reviewedAt: shop.reviewedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Có lỗi xảy ra khi thay đổi trạng thái gian hàng.' });
  }
};

export const updateShopOperatingStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã hồ sơ gian hàng không hợp lệ.' });
    }

    const { status, reason = '', notes = '', staffId, adminId } = req.body;
    const allowedStatuses = ['ACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED'];

    if (!status || !allowedStatuses.includes(String(status).toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Cho phép: ${allowedStatuses.join(', ')}`,
      });
    }

    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.' });
    }

    const targetStatus = String(status).toUpperCase();
    const reviewerId = (staffId && mongoose.Types.ObjectId.isValid(staffId))
      ? staffId
      : ((adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : null);

    shop.status = targetStatus;
    shop.reviewedBy = reviewerId;
    shop.reviewedAt = new Date();

    if (targetStatus === 'SUSPENDED' || targetStatus === 'REJECTED') {
      const defaultReason = targetStatus === 'SUSPENDED'
        ? 'Tạm ngưng hoạt động bởi Operations Staff.'
        : 'Từ chối hồ sơ bởi Operations Staff.';
      shop.rejectionReason = (reason && reason.trim()) ? reason.trim().slice(0, 500) : defaultReason;
    } else {
      shop.rejectionReason = '';
    }

    if (notes && typeof notes === 'string') {
      shop.notes = notes.trim().slice(0, 500);
    }

    // Nếu kích hoạt gian hàng, cập nhật Role của chủ sở hữu thành SHOP_OWNER
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
        rejectionReason: shop.rejectionReason,
        notes: shop.notes,
        reviewedAt: shop.reviewedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Có lỗi xảy ra khi cập nhật trạng thái vận hành.' });
  }
};

export const getMyShop = async (req, res) => {
  try {
    const { ownerId, managerId, branchId } = req.query;
    let shop = null;

    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      shop = await Shop.findById(branchId)
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    } else if (managerId && mongoose.Types.ObjectId.isValid(managerId)) {
      shop = await Shop.findOne({
        managerId,
        status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
      })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    } else if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      // First check if user is assigned as Branch Manager
      shop = await Shop.findOne({
        managerId: ownerId,
        status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
      })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();

      // If not branch manager, find branch owned as Shop Owner
      if (!shop) {
        shop = await Shop.findOne({
          ownerId,
          isHQ: true,
          status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
        })
          .populate('ownerId', 'FullName Email Role Status phone')
          .populate('managerId', 'FullName Email Role Status Information Avatar phone')
          .lean();
      }

      if (!shop) {
        shop = await Shop.findOne({
          ownerId,
          status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
        })
          .sort({ createdAt: 1 })
          .populate('ownerId', 'FullName Email Role Status phone')
          .populate('managerId', 'FullName Email Role Status Information Avatar phone')
          .lean();
      }
    }

    if (!shop) {
      shop = await Shop.findOne({ isHQ: true, status: 'ACTIVE' })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    }
    if (!shop) {
      shop = await Shop.findOne({ status: 'ACTIVE' })
        .populate('ownerId', 'FullName Email Role Status phone')
        .populate('managerId', 'FullName Email Role Status Information Avatar phone')
        .lean();
    }
    if (!shop) {
      shop = await Shop.findOne()
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

export const updateShopAddress = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã hồ sơ gian hàng không hợp lệ.',
      });
    }

    const {
      address,
      city = '',
      district = '',
      ward = '',
      latitude,
      longitude,
      phone,
    } = req.body;

    if (!city?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tỉnh/Thành phố là bắt buộc.',
      });
    }

    const trimmedAddress = address ? address.trim() : '';
    if (trimmedAddress && trimmedAddress.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ gian hàng không được vượt quá 255 ký tự.',
      });
    }

    let validLat = null;
    let validLng = null;
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      const pLat = Number(latitude);
      if (isNaN(pLat) || pLat < -90 || pLat > 90) {
        return res.status(400).json({
          success: false,
          message: 'Vĩ độ (Latitude) không hợp lệ (phải từ -90 đến 90 theo BR-03.05).',
        });
      }
      validLat = pLat;
    }

    if (longitude !== undefined && longitude !== null && longitude !== '') {
      const pLng = Number(longitude);
      if (isNaN(pLng) || pLng < -180 || pLng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Kinh độ (Longitude) không hợp lệ (phải từ -180 đến 180 theo BR-03.05).',
        });
      }
      validLng = pLng;
    }

    const shop = await Shop.findById(id);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gian hàng.',
      });
    }

    shop.address = trimmedAddress;
    shop.city = city.trim();
    shop.district = district ? district.trim() : '';
    shop.ward = ward ? ward.trim() : '';
    shop.latitude = validLat;
    shop.longitude = validLng;

    if (phone && phone.trim()) {
      const cleanPhone = phone.trim().replace(/\s+/g, '').replace(/^\+84/, '0');
      const phoneRegex = /^(0[35789])[0-9]{8}$/;
      if (phoneRegex.test(cleanPhone)) {
        shop.phone = cleanPhone;
      }
    }

    await shop.save();
    await shop.populate('ownerId', 'FullName Email Role Status phone');

    return res.json({
      success: true,
      message: 'Cập nhật địa chỉ và tọa độ GPS gian hàng thành công.',
      data: shop,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi cập nhật địa chỉ gian hàng.',
    });
  }
};

export const updateShopInfo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã hồ sơ gian hàng không hợp lệ.',
      });
    }

    const {
      name,
      description,
      phone,
      address,
      city,
      district,
      ward,
      latitude,
      longitude,
      imageUrl,
      openingHours,
      status,
      managerId,
      isHQ,
    } = req.body;

    const shop = await Shop.findById(id);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gian hàng.',
      });
    }

    if (name !== undefined) {
      const trimmedName = name?.trim();
      if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Tên gian hàng phải từ 3 đến 100 ký tự.',
        });
      }
      shop.name = trimmedName;
    }

    if (description !== undefined) {
      const trimmedDesc = description?.trim();
      if (!trimmedDesc || trimmedDesc.length < 10 || trimmedDesc.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Mô tả gian hàng phải từ 10 đến 1000 ký tự.',
        });
      }
      shop.description = trimmedDesc;
    }

    if (phone !== undefined) {
      const cleanPhone = phone?.trim().replace(/\s+/g, '').replace(/^\+84/, '0');
      const phoneRegex = /^(0[35789])[0-9]{8}$/;
      if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).',
        });
      }
      shop.phone = cleanPhone;
    }

    if (address !== undefined) {
      const trimmedAddress = address ? address.trim() : '';
      if (trimmedAddress && trimmedAddress.length > 255) {
        return res.status(400).json({
          success: false,
          message: 'Địa chỉ gian hàng không được vượt quá 255 ký tự.',
        });
      }
      shop.address = trimmedAddress;
    }

    if (city !== undefined) shop.city = city ? city.trim() : '';
    if (district !== undefined) shop.district = district ? district.trim() : '';
    if (ward !== undefined) shop.ward = ward ? ward.trim() : '';

    if (latitude !== undefined) {
      if (latitude === null || latitude === '') {
        shop.latitude = null;
      } else {
        const pLat = Number(latitude);
        if (isNaN(pLat) || pLat < -90 || pLat > 90) {
          return res.status(400).json({
            success: false,
            message: 'Vĩ độ (Latitude) không hợp lệ (phải từ -90 đến 90).',
          });
        }
        shop.latitude = pLat;
      }
    }

    if (longitude !== undefined) {
      if (longitude === null || longitude === '') {
        shop.longitude = null;
      } else {
        const pLng = Number(longitude);
        if (isNaN(pLng) || pLng < -180 || pLng > 180) {
          return res.status(400).json({
            success: false,
            message: 'Kinh độ (Longitude) không hợp lệ (phải từ -180 đến 180).',
          });
        }
        shop.longitude = pLng;
      }
    }

    if (imageUrl !== undefined) {
      shop.imageUrl = imageUrl?.trim() || '';
    }

    if (openingHours !== undefined) {
      shop.openingHours = openingHours?.trim() || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)';
    }

    if (status !== undefined && ['ACTIVE', 'SUSPENDED'].includes(status)) {
      shop.status = status;
    }

    if (managerId !== undefined) {
      if (!managerId || managerId === 'null' || managerId === 'none') {
        shop.managerId = null;
      } else if (mongoose.Types.ObjectId.isValid(managerId)) {
        const mgrUser = await User.findById(managerId);
        if (mgrUser) {
          shop.managerId = mgrUser._id;
          if (['customer', 'CUSTOMER'].includes(mgrUser.Role)) {
            mgrUser.Role = 'BRANCH_MANAGER';
            await mgrUser.save();
          }
        }
      }
    }

    if (isHQ !== undefined) {
      const boolHQ = Boolean(isHQ);
      if (boolHQ) {
        await Shop.updateMany(
          { _id: { $ne: shop._id }, ownerId: shop.ownerId, isHQ: true },
          { $set: { isHQ: false } }
        );
        shop.isHQ = true;
      } else {
        shop.isHQ = false;
      }
    }

    await shop.save();
    await shop.populate('ownerId', 'FullName Email Role Status phone');
    await shop.populate('managerId', 'FullName Email Role Status Information Avatar phone');

    return res.json({
      success: true,
      message: 'Cập nhật thông tin gian hàng và địa chỉ thành công.',
      data: shop,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi cập nhật thông tin gian hàng.',
    });
  }
};

// =====================================================================
// BRANCH MANAGEMENT CONTROLLERS (Single-Brand Multi-Branch Model)
// =====================================================================

export const createBranch = async (req, res) => {
  try {
    const {
      name,
      description,
      phone,
      address,
      city,
      district,
      ward,
      latitude,
      longitude,
      imageUrl,
      openingHours,
      managerId,
      isHQ = false,
      ownerId,
    } = req.body;

    const trimmedName = name?.trim();
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Tên chi nhánh là bắt buộc và phải từ 3 đến 100 ký tự.',
      });
    }

    const cleanPhone = phone?.trim().replace(/\s+/g, '').replace(/^\+84/, '0');
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại hotline chi nhánh không hợp lệ (10 số, đầu 03, 05, 07, 08, 09).',
      });
    }

    if (!city || !city.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tỉnh/Thành phố của chi nhánh là bắt buộc.',
      });
    }

    // Resolve ownerId
    let resolvedOwnerId = ownerId && mongoose.Types.ObjectId.isValid(ownerId) ? ownerId : null;
    if (!resolvedOwnerId) {
      const shopOwner = await User.findOne({ Role: { $in: ['SHOP_OWNER', 'shop_owner', 'OWNER', 'owner'] } });
      if (shopOwner) {
        resolvedOwnerId = shopOwner._id;
      } else {
        const adminUser = await User.findOne({ Role: { $in: ['ADMIN', 'admin'] } });
        if (adminUser) resolvedOwnerId = adminUser._id;
      }
    }

    if (!resolvedOwnerId) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy tài khoản Shop Owner để liên kết chi nhánh.',
      });
    }

    // Validate and link managerId if provided
    let validManagerId = null;
    if (managerId && mongoose.Types.ObjectId.isValid(managerId)) {
      const managerUser = await User.findById(managerId);
      if (managerUser) {
        validManagerId = managerUser._id;
        if (['customer', 'CUSTOMER'].includes(managerUser.Role)) {
          managerUser.Role = 'BRANCH_MANAGER';
          await managerUser.save();
        }
      }
    }

    // Coordinates validation
    let validLat = null;
    let validLng = null;
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      const pLat = Number(latitude);
      if (!isNaN(pLat) && pLat >= -90 && pLat <= 90) validLat = pLat;
    }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      const pLng = Number(longitude);
      if (!isNaN(pLng) && pLng >= -180 && pLng <= 180) validLng = pLng;
    }

    // If isHQ is true, reset other branches' isHQ
    if (Boolean(isHQ)) {
      await Shop.updateMany({ ownerId: resolvedOwnerId, isHQ: true }, { $set: { isHQ: false } });
    }

    const newBranch = new Shop({
      ownerId: resolvedOwnerId,
      managerId: validManagerId,
      isHQ: Boolean(isHQ),
      name: trimmedName,
      description: description?.trim() || 'Showroom thời trang dạ tiệc và thiết kế cao cấp Vestora.',
      phone: cleanPhone,
      address: address?.trim() || '',
      city: city.trim(),
      district: district?.trim() || '',
      ward: ward?.trim() || '',
      latitude: validLat,
      longitude: validLng,
      imageUrl: imageUrl?.trim() || '',
      openingHours: openingHours?.trim() || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
      status: 'ACTIVE',
    });

    await newBranch.save();
    await newBranch.populate('ownerId', 'FullName Email Role Status phone');
    await newBranch.populate('managerId', 'FullName Email Role Status Information Avatar phone');

    return res.status(201).json({
      success: true,
      message: `Khởi tạo chi nhánh "${newBranch.name}" thành công.`,
      data: newBranch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi khởi tạo chi nhánh mới.',
    });
  }
};

export const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã chi nhánh không hợp lệ.',
      });
    }

    const branch = await Shop.findById(id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chi nhánh cần xóa.',
      });
    }

    if (branch.isHQ) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa Trụ sở chính (HQ) của chuỗi. Hãy chỉ định chi nhánh khác làm HQ trước khi xóa.',
      });
    }

    const totalBranches = await Shop.countDocuments();
    if (totalBranches <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Chuỗi phải duy trì ít nhất một chi nhánh hoạt động. Không thể xóa toàn bộ chi nhánh.',
      });
    }

    await Shop.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: `Đã xóa chi nhánh "${branch.name}" khỏi hệ thống thành công.`,
      deletedId: id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi xóa chi nhánh.',
    });
  }
};

export const getBranchManagers = async (req, res) => {
  try {
    const users = await User.find(
      {
        Role: {
          $in: [
            'branch_manager',
            'BRANCH_MANAGER',
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

// =====================================================================
// BOUNDED IN-MEMORY GEOCODING CACHE (Max 500 entries, 12h TTL)
// =====================================================================
const GEO_CACHE = new Map();
const MAX_GEO_CACHE_SIZE = 500;
const GEO_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

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

export const reverseGeocodeAddress = async (req, res) => {
  try {
    const { lat, lng, latitude, longitude } = req.query;
    const targetLat = parseFloat(lat || latitude);
    const targetLng = parseFloat(lng || longitude);

    // 1. Strict Boundary & Number Validation
    if (
      isNaN(targetLat) ||
      isNaN(targetLng) ||
      targetLat < -90 ||
      targetLat > 90 ||
      targetLng < -180 ||
      targetLng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Tọa độ không hợp lệ (Vĩ độ phải từ -90 đến 90, Kinh độ từ -180 đến 180).',
      });
    }

    // 2. Check In-Memory Cache first
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

    // 3. Engine 1: BigDataCloud (Fast & accurate Vietnamese administrative names)
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

    // 4. Engine 2: Photon reverse geocoding (OpenStreetMap Komoot)
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

    // 5. Engine 3: OpenStreetMap Nominatim (Compliant User-Agent & Headers)
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

    // 6. Graceful Degradation: return raw coordinates
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
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi giải mã tọa độ địa chỉ GPS: ' + err.message,
    });
  }
};



