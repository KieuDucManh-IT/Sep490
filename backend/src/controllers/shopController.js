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
    const { status, search = '', ownerId, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status && ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'].includes(status)) {
      filter.status = status;
    }
    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      filter.ownerId = ownerId;
    }

    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchedUsers = await User.find({
        $or: [
          { FullName: { $regex: escapedSearch, $options: 'i' } },
          { Email: { $regex: escapedSearch, $options: 'i' } },
        ],
      }).select('_id');
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
        .populate('ownerId', 'FullName Email Role Status Infomation fullName email createdAt updatedAt')
        .populate('reviewedBy', 'FullName Email fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
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

    const [pending, active, rejected, newToday, avgResult] = await Promise.all([
      Shop.countDocuments({ status: 'PENDING' }),
      Shop.countDocuments({ status: 'ACTIVE' }),
      Shop.countDocuments({ status: 'REJECTED' }),
      Shop.countDocuments({ status: 'PENDING', createdAt: { $gte: today } }),
      Shop.aggregate([
        { $match: { status: { $in: ['ACTIVE', 'REJECTED'] }, reviewedAt: { $ne: null } } },
        {
          $project: {
            diffHours: {
              $divide: [{ $subtract: ['$reviewedAt', '$createdAt'] }, 3600000],
            },
          },
        },
        { $match: { diffHours: { $gt: 0 } } },
        { $group: { _id: null, avgHours: { $avg: '$diffHours' } } },
      ]),
    ]);

    const reviewed = active + rejected;
    const approvalRate = reviewed > 0 ? ((active / reviewed) * 100).toFixed(1) : '0.0';
    const rawAvg = avgResult.length > 0 ? avgResult[0].avgHours : 0;
    const avgProcessingHours = rawAvg > 0 ? (rawAvg < 0.1 ? '0.1' : rawAvg.toFixed(1)) : '0.0';

    return res.json({
      success: true,
      counts: {
        PENDING: pending,
        ACTIVE: active,
        REJECTED: rejected,
      },
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
      .populate('ownerId', 'FullName Email Role Status fullName email phone')
      .populate('reviewedBy', 'FullName Email fullName email');

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

    const { adminId } = req.body;
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.' });
    }

    if (!['ACTIVE', 'SUSPENDED'].includes(shop.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể tạm ngưng hoặc kích hoạt gian hàng đang hoạt động.',
      });
    }

    shop.status = shop.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    shop.reviewedBy = (adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : null;
    shop.reviewedAt = new Date();

    await shop.save();

    return res.json({
      success: true,
      message:
        shop.status === 'SUSPENDED'
          ? `Gian hàng "${shop.name}" đã được tạm ngưng hoạt động.`
          : `Gian hàng "${shop.name}" đã được kích hoạt hoạt động trở lại.`,
      data: { shopId: shop._id, status: shop.status },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Có lỗi xảy ra khi thay đổi trạng thái gian hàng.' });
  }
};
