import {
  validateCreateBranchInput,
  validateUpdateShopAddressInput,
  validateUpdateShopInfoInput,
  validateOperatingStatus,
  validateReverseGeocodeQuery,
} from '../../validations/shop/shopValidation.js';

import {
  listShopApplications,
  getShopStatistics,
  getShopDetails,
  toggleShopSuspension,
  updateOperatingStatus,
  resolveMyShopProfile,
  resolveAssignedBranchForUser,
  updateBranchAddress,
  updateBranchInfo,
  createNewBranch,
  removeBranch,
  listEligibleBranchManagers,
} from '../../services/shop/shopBranchService.js';

import { resolveReverseGeocode } from '../../services/shop/geoService.js';
import { processAndUploadShopMedia } from '../../services/shop/shopMediaService.js';

/**
 * Controller: Quản lý chi nhánh & hồ sơ gian hàng (Role: Shop Owner, Branch Manager, Admin)
 * Phụ trách nhận HTTP Request, gọi các Service chuyên biệt và trả về HTTP Response chuẩn.
 */

/**
 * Lấy danh sách hồ sơ chi nhánh có phân trang, bộ lọc và tìm kiếm
 * GET /api/shops
 */
export const getShopApplications = async (req, res) => {
  try {
    const { status, search = '', ownerId, city = '', page = 1, limit = 10 } = req.query;

    const result = await listShopApplications({
      status,
      search,
      ownerId,
      city,
      page,
      limit,
    });

    return res.json({
      success: true,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      data: result.data,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Không thể tải danh sách hồ sơ chi nhánh.',
    });
  }
};

/**
 * Lấy số liệu thống kê tổng hợp mạng lưới chi nhánh theo trạng thái
 * GET /api/shops/stats
 */
export const getShopStats = async (_req, res) => {
  try {
    const stats = await getShopStatistics();

    return res.json({
      success: true,
      counts: stats.counts,
      totalShops: stats.totalShops,
      newToday: stats.newToday,
      approvalRate: stats.approvalRate,
      avgProcessingHours: stats.avgProcessingHours,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Không thể lấy số liệu thống kê.',
    });
  }
};

/**
 * Xem thông tin chi tiết một chi nhánh theo ID
 * GET /api/shops/:id
 */
export const getShopById = async (req, res) => {
  try {
    const shop = await getShopDetails(req.params.id);
    return res.json({ success: true, data: shop });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Không thể xem chi tiết gian hàng.',
    });
  }
};

/**
 * Tạm ngưng hoặc kích hoạt lại hoạt động của chi nhánh
 * PUT /api/shops/:id/toggle-suspend
 */
export const toggleSuspendShop = async (req, res) => {
  try {
    const result = await toggleShopSuspension(req.params.id, req.user);

    return res.json({
      success: true,
      message: result.message,
      data: {
        shopId: result.shopId,
        status: result.status,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Có lỗi xảy ra khi thay đổi trạng thái gian hàng.',
    });
  }
};

/**
 * Cập nhật trạng thái vòng đời hoạt động của gian hàng (Admin)
 * PUT /api/shops/:id/operating-status
 */
export const updateShopOperatingStatus = async (req, res) => {
  try {
    const targetStatus = validateOperatingStatus(req.body.status);
    const result = await updateOperatingStatus(req.params.id, targetStatus);

    return res.json({
      success: true,
      message: result.message,
      data: {
        shopId: result.shopId,
        name: result.name,
        status: result.status,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Có lỗi xảy ra khi cập nhật trạng thái vận hành.',
    });
  }
};

/**
 * Lấy thông tin gian hàng mặc định của người dùng hoặc hệ thống
 * GET /api/shops/my-shop
 */
export const getMyShop = async (req, res) => {
  try {
    const { ownerId, managerId, branchId } = req.query;
    const shop = await resolveMyShopProfile({ ownerId, managerId, branchId });

    return res.json({
      success: true,
      data: shop,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi khi tải thông tin gian hàng.',
    });
  }
};

/**
 * Lấy chi nhánh được chỉ định cho tài khoản đã xác thực
 * GET /api/shops/assigned-branch
 */
export const getAssignedBranch = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = (req.user?.Role || req.user?.role || '').toLowerCase();
    const { branchId } = req.query;

    const result = await resolveAssignedBranchForUser({
      userId,
      userRole,
      branchId,
    });

    if (!result.hasAssignment) {
      return res.json({
        success: true,
        data: null,
        assignedBranches: result.assignedBranches,
        message: 'Tài khoản chưa được chỉ định quản lý chi nhánh nào.',
      });
    }

    return res.json({
      success: true,
      data: result.shop,
      assignedBranches: result.assignedBranches,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi khi lấy thông tin chi nhánh được chỉ định.',
    });
  }
};

/**
 * Cập nhật địa chỉ và vị trí bản đồ số của chi nhánh
 * PUT /api/shops/:id/address
 */
export const updateShopAddress = async (req, res) => {
  try {
    const validatedData = validateUpdateShopAddressInput(req.body);
    const updatedShop = await updateBranchAddress(req.params.id, validatedData, req.user);

    return res.json({
      success: true,
      message: 'Cập nhật địa chỉ và tọa độ GPS gian hàng thành công.',
      data: updatedShop,
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
 * Cập nhật toàn bộ thông tin chi nhánh, quản lý bổ nhiệm và cờ Trụ sở chính
 * PUT /api/shops/:id/info hoặc PUT /api/shops/:id
 */
export const updateShopInfo = async (req, res) => {
  try {
    const validated = validateUpdateShopInfoInput(req.body);
    const updatedShop = await updateBranchInfo(req.params.id, validated, req.user);

    return res.json({
      success: true,
      message: 'Cập nhật thông tin gian hàng và địa chỉ thành công.',
      data: updatedShop,
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
 * Hàm hỗ trợ hạ cấp (deprecated - giữ lại để đảm bảo tương thích mã nguồn)
 */
export const checkAndDemoteBranchManager = async (_managerId) => {
  return;
};

/**
 * Khởi tạo chi nhánh mới trong hệ thống
 * POST /api/shops
 */
export const createBranch = async (req, res) => {
  try {
    const validated = validateCreateBranchInput(req.body);
    const newBranch = await createNewBranch(validated, req.user);

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
 * Xóa mềm chi nhánh khỏi hệ thống (bảo vệ Trụ sở chính và tối thiểu 1 cơ sở)
 * DELETE /api/shops/:id
 */
export const deleteBranch = async (req, res) => {
  try {
    const result = await removeBranch(req.params.id, req.user);

    return res.json({
      success: true,
      message: `Đã xóa chi nhánh "${result.branchName}" khỏi hệ thống thành công.`,
      deletedId: result.deletedId,
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
 * Lấy danh sách tài khoản đủ điều kiện bổ nhiệm Quản lý chi nhánh
 * GET /api/shops/managers
 */
export const getBranchManagers = async (_req, res) => {
  try {
    const managers = await listEligibleBranchManagers();

    return res.json({
      success: true,
      data: managers,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi khi lấy danh sách quản lý chi nhánh.',
    });
  }
};

/**
 * Giải mã tọa độ bản đồ số sang địa giới hành chính
 * GET /api/shops/reverse-geocode
 */
export const reverseGeocodeAddress = async (req, res) => {
  try {
    const { targetLat, targetLng } = validateReverseGeocodeQuery(req.query);
    const result = await resolveReverseGeocode(targetLat, targetLng);

    return res.json({
      success: true,
      source: result.source,
      data: result.data,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi khi giải mã tọa độ địa chỉ GPS.',
    });
  }
};

/**
 * Nén và tải ảnh Logo / Ảnh bìa chi nhánh lên Cloudinary
 * POST /api/shops/upload-image
 */
export const uploadShopImage = async (req, res, next) => {
  try {
    const file = req.file;
    const imageType = req.body?.type === 'banner' ? 'banner' : 'avatar';
    const host = req.get('host') || 'localhost:5001';
    const protocol = req.protocol || 'http';

    const uploadResult = await processAndUploadShopMedia({
      file,
      imageType,
      host,
      protocol,
    });

    return res.status(200).json(uploadResult);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};
