import { Shop } from '../models/Shop.js';
import { User } from '../models/system/User.js';

/**
 * View chain-wide statistics and analytical metrics
 */
export const getAdminMetrics = async (req, res) => {
  try {
    const [userFacet, branchFacet] = await Promise.all([
      User.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byRole: [{ $group: { _id: { $toLower: '$Role' }, count: { $sum: 1 } } }],
          },
        },
      ]),
      Shop.aggregate([
        { $match: { isDeleted: { $ne: true } } },
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

    const branchStatuses = {};
    (branchFacet?.[0]?.byStatus || []).forEach((s) => {
      if (s._id) branchStatuses[s._id] = s.count;
    });

    const totalUsers = userFacet?.[0]?.total?.[0]?.count || 0;
    const totalCustomers = userRoles.customer || 0;
    const totalStaff = (userRoles.shop_owner || 0) + (userRoles.operation_staff || 0);

    const totalBranches = branchFacet?.[0]?.total?.[0]?.count || 0;
    const activeBranches = branchStatuses.active || 0;
    const suspendedBranches = branchStatuses.suspended || 0;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          staff: totalStaff,
        },
        branches: {
          total: totalBranches,
          active: activeBranches,
          suspended: suspendedBranches,
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

/**
 * Retrieve internal product listings pending moderation
 */
export const getPendingModeration = async (req, res) => {
  try {
    res.json({
      success: true,
      count: 0,
      data: {
        products: [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
