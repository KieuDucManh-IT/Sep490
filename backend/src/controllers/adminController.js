import { Shop } from '../models/Shop.js';
import { User } from '../models/User.js';

// Tổng quan Dashboard Admin Analytics
export const getAdminMetrics = async (req, res) => {
  try {
    const [userFacet, shopFacet] = await Promise.all([
      User.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byRole: [{ $group: { _id: { $toLower: '$Role' }, count: { $sum: 1 } } }],
          },
        },
      ]),
      Shop.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: { $toLower: '$status' }, count: { $sum: 1 } } }],
          },
        },
      ]),
    ]);

    const userRoles = {};
    (userFacet?.[0]?.byRole || []).forEach((r) => {
      if (r._id) userRoles[r._id] = r.count;
    });

    const shopStatuses = {};
    (shopFacet?.[0]?.byStatus || []).forEach((s) => {
      if (s._id) shopStatuses[s._id] = s.count;
    });

    const totalUsers = userFacet?.[0]?.total?.[0]?.count || 0;
    const totalCustomers = userRoles.customer || 0;
    const totalShopOwners = userRoles.shop_owner || 0;

    const totalShops = shopFacet?.[0]?.total?.[0]?.count || 0;
    const pendingShops = shopStatuses.pending || 0;
    const activeShops = shopStatuses.active || 0;
    const rejectedShops = shopStatuses.rejected || 0;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          shopOwners: totalShopOwners,
        },
        shops: {
          total: totalShops,
          pending: pendingShops,
          active: activeShops,
          rejected: rejectedShops,
        },
        platformRevenue: 125000000,
        escrowHolding: 45000000,
      },
    });
  } catch (error) {
    console.error('Error in getAdminMetrics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy danh sách cần kiểm duyệt (Shop pending)
export const getPendingModeration = async (req, res) => {
  try {
    const pendingShops = await Shop.find({ status: 'PENDING' }).sort({ createdAt: -1 }).lean();

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
