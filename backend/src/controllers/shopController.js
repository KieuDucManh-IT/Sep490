import mongoose from 'mongoose';
import { Shop } from '../models/Shop.js';
import { User } from '../models/User.js';

export const applyShop = async (req, res) => {
  try {
    const {
      ownerId, name, description, phone, address,
      city, district, imageUrl,
      businessLicenseUrl, idCardFrontUrl, idCardBackUrl,
    } = req.body;

    const validOwnerId = (ownerId && mongoose.Types.ObjectId.isValid(ownerId))
      ? ownerId
      : new mongoose.Types.ObjectId();

    const existing = await Shop.findOne({ ownerId: validOwnerId, status: { $in: ['PENDING', 'ACTIVE'] } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          existing.status === 'ACTIVE'
            ? 'Tài khoản này đã có gian hàng đang hoạt động.'
            : 'Đã có hồ sơ đăng ký đang chờ thẩm định. Vui lòng chờ kết quả.',
      });
    }

    const shop = new Shop({
      ownerId: validOwnerId, name, description, phone, address,
      city, district, imageUrl,
      businessLicenseUrl, idCardFrontUrl, idCardBackUrl,
      status: 'PENDING',
    });

    await shop.save();

    return res.status(201).json({
      success: true,
      message: 'Hồ sơ đăng ký gian hàng đã được gửi. Vui lòng chờ Admin thẩm định trong 24–48 giờ.',
      data: {
        applicationCode: shop._id,
        shopName: shop.name,
        status: shop.status,
        submittedAt: shop.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getShopApplications = async (req, res) => {
  try {
    const { status, search = '', page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } },
        { address: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [shops, total] = await Promise.all([
      Shop.find(filter)
        .populate('ownerId', 'FullName Email Role Status Infomation fullName email')
        .populate('reviewedBy', 'FullName Email fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Shop.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data: shops,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id)
      .populate('ownerId', 'fullName email phone')
      .populate('reviewedBy', 'fullName email');

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ gian hàng.' });
    }

    return res.json({ success: true, data: shop });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const approveShop = async (req, res) => {
  try {
    const { adminId, notes = '' } = req.body;
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ gian hàng.' });
    }

    if (shop.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Hồ sơ đang ở trạng thái "${shop.status}", không thể thẩm định lại.`,
      });
    }

    const validAdminId = (adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : null;

    shop.status = 'ACTIVE';
    shop.notes = notes;
    shop.reviewedBy = validAdminId;
    shop.reviewedAt = new Date();
    shop.rejectionReason = '';

    await shop.save();

    if (shop.ownerId) {
      await User.findByIdAndUpdate(shop.ownerId, { Role: 'SHOP_OWNER', role: 'SHOP_OWNER' });
    }

    return res.json({
      success: true,
      message: `Gian hàng "${shop.name}" đã được phê duyệt thành công.`,
      data: { shopId: shop._id, status: shop.status, reviewedAt: shop.reviewedAt },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectShop = async (req, res) => {
  try {
    const { adminId, rejectionReason, notes = '' } = req.body;
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ gian hàng.' });
    }

    if (shop.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Hồ sơ đang ở trạng thái "${shop.status}", không thể thẩm định lại.`,
      });
    }

    if (!rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Lý do từ chối là bắt buộc khi từ chối hồ sơ.',
      });
    }

    const validAdminId = (adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : null;

    shop.status = 'REJECTED';
    shop.rejectionReason = rejectionReason.trim();
    shop.notes = notes;
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleSuspendShop = async (req, res) => {
  try {
    const { adminId } = req.body;
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.' });
    }

    if (!['ACTIVE', 'SUSPENDED'].includes(shop.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể tạm ngưng/kích hoạt gian hàng đang ACTIVE hoặc SUSPENDED.',
      });
    }

    shop.status = shop.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    shop.reviewedBy = adminId;
    shop.reviewedAt = new Date();

    await shop.save();

    return res.json({
      success: true,
      message:
        shop.status === 'SUSPENDED'
          ? `Gian hàng "${shop.name}" đã bị tạm ngưng.`
          : `Gian hàng "${shop.name}" đã được kích hoạt trở lại.`,
      data: { shopId: shop._id, status: shop.status },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
