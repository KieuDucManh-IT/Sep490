import { Shop } from '../models/Shop.js';

// Lấy danh sách tất cả gian hàng (có thể lọc theo status)
export const getShops = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status.toUpperCase();
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { taxCode: { $regex: search, $options: 'i' } }
      ];
    }

    const shops = await Shop.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: shops.length,
      data: shops
    });
  } catch (error) {
    console.error('Error in getShops:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy chi tiết gian hàng theo ID
export const getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng' });
    }
    res.json({ success: true, data: shop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật trạng thái duyệt gian hàng (Approve / Reject / Lock)
export const updateShopStatus = async (req, res) => {
  try {
    const { status, rejectionReason, notes } = req.body;
    const validStatuses = ['PENDING', 'ACTIVE', 'REJECTED', 'LOCKED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Trạng thái không hợp lệ. Phải là một trong: ${validStatuses.join(', ')}` 
      });
    }

    const updateData = {
      status,
      reviewedAt: new Date()
    };

    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
    if (notes !== undefined) updateData.notes = notes;

    const updatedShop = await Shop.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedShop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng để cập nhật' });
    }

    res.json({
      success: true,
      message: `Cập nhật trạng thái gian hàng sang ${status} thành công`,
      data: updatedShop
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Thống kê gian hàng cho Admin Dashboard
export const getShopStats = async (req, res) => {
  try {
    const total = await Shop.countDocuments();
    const pending = await Shop.countDocuments({ status: 'PENDING' });
    const active = await Shop.countDocuments({ status: 'ACTIVE' });
    const rejected = await Shop.countDocuments({ status: 'REJECTED' });

    res.json({
      success: true,
      data: {
        total,
        pending,
        active,
        rejected
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
