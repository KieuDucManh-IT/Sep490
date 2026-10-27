import { Shop } from '../models/Shop.js';
import { User } from '../models/system/User.js';

// Tổng quan Dashboard Admin Analytics
export const getAdminMetrics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCustomers = await User.countDocuments({ Role: { $regex: /^customer$/i } });
    const totalShopOwners = await User.countDocuments({ Role: { $regex: /^shop_owner$/i } });

    const totalShops = await Shop.countDocuments();
    const pendingShops = await Shop.countDocuments({ status: { $regex: /^pending$/i } });
    const activeShops = await Shop.countDocuments({ status: { $regex: /^active$/i } });
    const rejectedShops = await Shop.countDocuments({ status: { $regex: /^rejected$/i } });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          shopOwners: totalShopOwners
        },
        shops: {
          total: totalShops,
          pending: pendingShops,
          active: activeShops,
          rejected: rejectedShops
        },
        platformRevenue: 125000000,
        escrowHolding: 45000000
      }
    });
  } catch (error) {
    console.error('Error in getAdminMetrics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách cần kiểm duyệt (Shop pending)
export const getPendingModeration = async (req, res) => {
  try {
    const pendingShops = await Shop.find({ status: 'PENDING' }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingShops.length,
      data: {
        shops: pendingShops,
        products: [] // Sẵn sàng mở rộng khi có sản phẩm cần duyệt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
