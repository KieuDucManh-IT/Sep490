import mongoose from 'mongoose';
import { Shop } from '../models/Shop.js';
import { User } from '../models/User.js';

export const applyShop = async (req, res) => {
  try {
    const {
      ownerId,
      ownerName = '',
      ownerEmail = '',
      name,
      description,
      phone,
      address,
      city = '',
      district = '',
      ward = '',
      imageUrl = '',
      businessLicenseUrl = '',
      idCardFrontUrl = '',
      idCardBackUrl = '',
      latitude = null,
      longitude = null,
    } = req.body;

    if (!name?.trim() || !description?.trim() || !phone?.trim() || !address?.trim() || !city?.trim() || !ward?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ các thông tin bắt buộc (Tên gian hàng, mô tả, số điện thoại, tỉnh/thành phố, phường/xã, địa chỉ cụ thể).',
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Tên gian hàng phải từ 3 đến 100 ký tự.',
      });
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 10 || trimmedDesc.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Mô tả gian hàng phải từ 10 đến 1000 ký tự.',
      });
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '').replace(/^\+84/, '0');
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 chữ số của Việt Nam (bắt đầu bằng 03, 05, 07, 08, 09).',
      });
    }

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 3 || trimmedAddress.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ gian hàng phải từ 3 đến 255 ký tự.',
      });
    }

    if (!businessLicenseUrl?.trim() || !idCardFrontUrl?.trim() || !idCardBackUrl?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên đầy đủ Giấy phép kinh doanh và ảnh CCCD 2 mặt để thẩm định.',
      });
    }

    const cleanEmail = ownerEmail?.trim()?.toLowerCase() || '';
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ email liên hệ không đúng định dạng (VD: example@email.com).',
      });
    }

    const parsedLat = (latitude !== undefined && latitude !== null && latitude !== '') ? Number(latitude) : null;
    const parsedLng = (longitude !== undefined && longitude !== null && longitude !== '') ? Number(longitude) : null;
    let validLat = null;
    let validLng = null;
    if (Number.isFinite(parsedLat)) {
      if (parsedLat < -90 || parsedLat > 90) {
        return res.status(400).json({ success: false, message: 'Vĩ độ không hợp lệ (phải từ -90 đến 90).' });
      }
      validLat = parsedLat;
    }
    if (Number.isFinite(parsedLng)) {
      if (parsedLng < -180 || parsedLng > 180) {
        return res.status(400).json({ success: false, message: 'Kinh độ không hợp lệ (phải từ -180 đến 180).' });
      }
      validLng = parsedLng;
    }

    let targetOwnerId = null;

    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      const existingUser = await User.findById(ownerId);
      if (existingUser) {
        if (existingUser.Status === 'BANNED') {
          return res.status(403).json({
            success: false,
            message: 'Tài khoản của bạn đã bị khóa, không thể đăng ký mở gian hàng.',
          });
        }
        targetOwnerId = existingUser._id;
      }
    }

    if (!targetOwnerId && cleanEmail) {
      let existingUser = await User.findOne({ Email: cleanEmail });
      if (existingUser) {
        if (existingUser.Status === 'BANNED') {
          return res.status(403).json({
            success: false,
            message: 'Tài khoản của bạn đã bị khóa, không thể đăng ký mở gian hàng.',
          });
        }
        targetOwnerId = existingUser._id;
      } else {
        existingUser = await User.create({
          Email: cleanEmail,
          FullName: ownerName?.trim() || trimmedName,
          Role: 'CUSTOMER',
          Status: 'ACTIVE',
        });
        targetOwnerId = existingUser._id;
      }
    }

    if (!targetOwnerId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email liên hệ hợp lệ để nhận kết quả xét duyệt.',
      });
    }

    if (ownerName?.trim()) {
      await User.findByIdAndUpdate(targetOwnerId, {
        $set: { FullName: ownerName.trim() },
      });
    }

    const existingShop = await Shop.findOne({
      ownerId: targetOwnerId,
      status: { $in: ['PENDING', 'ACTIVE'] },
    });

    if (existingShop) {
      return res.status(400).json({
        success: false,
        message:
          existingShop.status === 'ACTIVE'
            ? `Tài khoản của bạn đã có gian hàng "${existingShop.name}" đang hoạt động.`
            : `Tài khoản của bạn đã có hồ sơ gian hàng "${existingShop.name}" đang chờ xét duyệt.`,
        data: {
          existingShopId: existingShop._id,
          shop: existingShop,
        },
      });
    }

    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const duplicateNameShop = await Shop.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      status: { $in: ['PENDING', 'ACTIVE'] },
    });

    if (duplicateNameShop && String(duplicateNameShop.ownerId) !== String(targetOwnerId)) {
      return res.status(400).json({
        success: false,
        message: `Tên gian hàng "${trimmedName}" đã được sử dụng hoặc đang chờ xét duyệt bởi người khác. Vui lòng chọn tên khác.`,
      });
    }

    const shop = new Shop({
      ownerId: targetOwnerId,
      name: trimmedName,
      description: trimmedDesc,
      phone: cleanPhone,
      address: trimmedAddress,
      city: city.trim(),
      district: district.trim(),
      ward: ward.trim(),
      latitude: validLat,
      longitude: validLng,
      imageUrl: imageUrl?.trim() || '',
      businessLicenseUrl: businessLicenseUrl.trim(),
      idCardFrontUrl: idCardFrontUrl.trim(),
      idCardBackUrl: idCardBackUrl.trim(),
      status: 'PENDING',
    });

    await shop.save();
    await shop.populate('ownerId', 'FullName Email Role Status fullName email');

    return res.status(201).json({
      success: true,
      message: 'Hồ sơ đăng ký gian hàng đã được gửi thành công và đang chờ xét duyệt.',
      data: {
        applicationCode: shop._id,
        shopName: shop.name,
        status: shop.status,
        submittedAt: shop.createdAt,
        shop,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

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
        .populate('reviewedBy', 'FullName Email fullName email')
        .sort({ createdAt: -1 })
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

export const approveShop = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã hồ sơ gian hàng không hợp lệ.' });
    }

    const { adminId, notes = '' } = req.body;
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ gian hàng.' });
    }

    if (shop.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Hồ sơ đang ở trạng thái "${shop.status}", không thể duyệt lại.`,
      });
    }

    if (shop.ownerId) {
      const owner = await User.findById(shop.ownerId);
      if (owner) {
        if (owner.Status === 'BANNED') {
          return res.status(400).json({
            success: false,
            message: 'Không thể phê duyệt do tài khoản chủ sở hữu đang bị khóa.',
          });
        }
        owner.Role = 'SHOP_OWNER';
        await owner.save();
      }
    }

    const validAdminId = (adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : null;

    shop.status = 'ACTIVE';
    shop.notes = typeof notes === 'string' ? notes.trim().slice(0, 500) : '';
    shop.reviewedBy = validAdminId;
    shop.reviewedAt = new Date();
    shop.rejectionReason = '';

    await shop.save();

    return res.json({
      success: true,
      message: `Gian hàng "${shop.name}" đã được phê duyệt thành công.`,
      data: { shopId: shop._id, status: shop.status, reviewedAt: shop.reviewedAt },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Có lỗi xảy ra khi phê duyệt gian hàng.' });
  }
};

export const rejectShop = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Mã hồ sơ gian hàng không hợp lệ.' });
    }

    const { adminId, rejectionReason, notes = '' } = req.body;
    const trimmedReason = rejectionReason?.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do từ chối cụ thể (tối thiểu 5 ký tự).',
      });
    }

    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ gian hàng.' });
    }

    if (shop.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Hồ sơ đang ở trạng thái "${shop.status}", không thể từ chối lại.`,
      });
    }

    const validAdminId = (adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : null;

    shop.status = 'REJECTED';
    shop.rejectionReason = trimmedReason.slice(0, 500);
    shop.notes = typeof notes === 'string' ? notes.trim().slice(0, 500) : '';
    shop.reviewedBy = validAdminId;
    shop.reviewedAt = new Date();

    await shop.save();

    return res.json({
      success: true,
      message: `Hồ sơ gian hàng "${shop.name}" đã bị từ chối.`,
      data: {
        shopId: shop._id,
        status: shop.status,
        rejectionReason: shop.rejectionReason,
        reviewedAt: shop.reviewedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Có lỗi xảy ra khi từ chối hồ sơ.' });
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

export const getMyShop = async (req, res) => {
  try {
    const { ownerId } = req.query;
    let shop = null;

    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      shop = await Shop.findOne({
        ownerId,
        status: { $in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
      })
        .populate('ownerId', 'FullName Email Role Status phone')
        .lean();

      if (!shop) {
        return res.status(404).json({
          success: false,
          message: 'Chưa tìm thấy gian hàng nào liên kết với tài khoản này.',
        });
      }
    } else {
      shop = await Shop.findOne({ status: 'ACTIVE' })
        .populate('ownerId', 'FullName Email Role Status phone')
        .lean();
      if (!shop) {
        shop = await Shop.findOne()
          .populate('ownerId', 'FullName Email Role Status phone')
          .lean();
      }
    }

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Chưa tìm thấy gian hàng nào trên hệ thống.',
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

    await shop.save();
    await shop.populate('ownerId', 'FullName Email Role Status phone');

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

export const reverseGeocodeAddress = async (req, res) => {
  try {
    const { lat, lng, latitude, longitude } = req.query;
    const targetLat = parseFloat(lat || latitude);
    const targetLng = parseFloat(lng || longitude);

    if (isNaN(targetLat) || isNaN(targetLng)) {
      return res.status(400).json({
        success: false,
        message: 'Tọa độ vĩ độ hoặc kinh độ không hợp lệ.',
      });
    }

    // 1. Try BigDataCloud (Fast & accurate Vietnamese administrative names)
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${targetLat}&longitude=${targetLng}&localityLanguage=vi`;
      const bdcRes = await fetch(bdcUrl, { signal: AbortSignal.timeout(4000) });
      if (bdcRes.ok) {
        const d = await bdcRes.json();
        const city = d.principalSubdivision || d.city || '';
        const ward = d.locality || '';
        if (city) {
          return res.json({
            success: true,
            data: {
              latitude: targetLat,
              longitude: targetLng,
              city,
              ward,
              district: d.locality || '',
              country: d.countryName || 'Việt Nam',
            },
          });
        }
      }
    } catch (_) { }

    // 2. Try Photon reverse geocoding
    try {
      const photonUrl = `https://photon.komoot.io/reverse?lat=${targetLat}&lon=${targetLng}`;
      const photonRes = await fetch(photonUrl, { signal: AbortSignal.timeout(4000) });
      if (photonRes.ok) {
        const pData = await photonRes.json();
        const prop = pData?.features?.[0]?.properties;
        if (prop) {
          const city = prop.city || prop.state || prop.county || '';
          const ward = prop.district || prop.locality || prop.name || '';
          const street = [prop.housenumber, prop.street].filter(Boolean).join(' ');
          return res.json({
            success: true,
            data: {
              latitude: targetLat,
              longitude: targetLng,
              city,
              ward,
              district: prop.district || '',
              street,
            },
          });
        }
      }
    } catch (_) { }

    return res.json({
      success: true,
      data: {
        latitude: targetLat,
        longitude: targetLng,
        city: '',
        ward: '',
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi giải mã tọa độ địa chỉ GPS: ' + err.message,
    });
  }
};


