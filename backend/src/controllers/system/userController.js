import { User } from '../../models/system/User.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { Shop } from '../../models/shop/Shop.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../utils/sendEmail.js';
import { validateUserUpdate, validateUserCreate } from '../../utils/userValidation.js';
import {
  buildLockEmailHtml,
  buildLockEmailText,
  buildNewStaffEmailText,
  buildResetPasswordEmailHtml,
  buildResetPasswordEmailText
} from '../../utils/userEmailTemplates.js';


async function enrichUsersWithStats(users = []) {
  if (!users || !users.length) return [];

  const userIds = users.map((u) => u._id).filter(Boolean);

  let rentalStats = [];
  let salesStats = [];
  let shopStats = [];
  let locationStats = [];

  if (userIds.length > 0) {
    try {
      [rentalStats, salesStats, shopStats, locationStats] = await Promise.all([
        RentalOrder.aggregate([
          { $match: { customerId: { $in: userIds } } },
          {
            $group: {
              _id: '$customerId',
              totalOrders: { $sum: 1 },
              totalDeposit: { $sum: '$depositAmount' },
              totalRentalFee: { $sum: '$rentalFee' }
            }
          }
        ]).catch(() => []),
        SalesOrder.aggregate([
          { $match: { customerId: { $in: userIds } } },
          {
            $group: {
              _id: '$customerId',
              totalOrders: { $sum: 1 },
              totalAmount: { $sum: '$totalAmount' }
            }
          }
        ]).catch(() => []),
        Shop.aggregate([
          { $match: { ownerId: { $in: userIds }, isDeleted: { $ne: true } } },
          {
            $group: {
              _id: '$ownerId',
              totalShops: { $sum: 1 }
            }
          }
        ]).catch(() => []),
        InventoryLocation.aggregate([
          { $match: { managerId: { $in: userIds }, status: 'active' } },
          {
            $group: {
              _id: '$managerId',
              totalWarehouses: { $sum: 1 }
            }
          }
        ]).catch(() => [])
      ]);
    } catch (err) {
      console.warn('Lỗi khi tính toán thống kê tài khoản:', err.message);
    }
  }

  const rentalMap = new Map((rentalStats || []).map((r) => [String(r._id), r]));
  const salesMap = new Map((salesStats || []).map((s) => [String(s._id), s]));
  const shopMap = new Map((shopStats || []).map((sh) => [String(sh._id), sh]));
  const locationMap = new Map((locationStats || []).map((l) => [String(l._id), l]));

  return users.map((u) => {
    const raw = typeof u.toObject === 'function' ? u.toObject() : { ...u };
    const uid = String(raw._id);
    const r = rentalMap.get(uid);
    const s = salesMap.get(uid);
    const sh = shopMap.get(uid);
    const loc = locationMap.get(uid);

    const rentalOrdersCount = r?.totalOrders || 0;
    const salesOrdersCount = s?.totalOrders || 0;
    const totalOrders = rentalOrdersCount;
    const totalDeposit = r?.totalDeposit || 0;
    const totalRentalFee = r?.totalRentalFee || 0;
    const totalShops = sh?.totalShops || 0;
    const totalWarehouses = loc?.totalWarehouses || 0;
    const violations = raw.WarningsCount || 0;

    let rating = 'A+ (100 pts)';
    if (violations > 0) {
      rating = `C (${violations} vi phạm)`;
    } else if (totalOrders > 0) {
      rating = 'A+ (100 pts)';
    } else {
      rating = 'A (100 pts)';
    }

    const totalDepositFormatted =
      totalDeposit > 0 ? `${totalDeposit.toLocaleString('vi-VN')} đ` : '0 đ';

    const info = Array.isArray(raw.Information) && raw.Information.length > 0 ? raw.Information[0] : {};
    const dob = raw.DateOfBirth || info.DateOfBirth || '';
    const gender = raw.Gender || info.Gender || '';

    return {
      ...raw,
      DateOfBirth: dob,
      Gender: gender,
      totalOrders,
      rentalOrdersCount,
      salesOrdersCount,
      totalDeposit,
      totalDepositFormatted,
      totalRentalFee,
      totalShops,
      totalWarehouses,
      violations,
      rating,
      stats: {
        totalOrders,
        rentalOrdersCount,
        salesOrdersCount,
        totalDeposit,
        totalDepositFormatted,
        totalRentalFee,
        totalShops,
        totalWarehouses,
        violations,
        rating
      }
    };
  });
}


export const getUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const filter = {};

    if (role) {
      filter.Role = { $regex: new RegExp(`^${role}$`, 'i') };
    }

    if (status) {
      filter.Status = { $regex: new RegExp(`^${status}$`, 'i') };
    }

    if (search) {
      filter.$or = [
        { FullName: { $regex: search, $options: 'i' } },
        { Email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-PasswordHash')
      .sort({ createdAt: -1 })
      .lean();

    const enrichedUsers = await enrichUsersWithStats(users);

    res.json({
      success: true,
      count: enrichedUsers.length,
      data: enrichedUsers
    });
  } catch (error) {
    console.error('Error in getUsers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Chi tiết tài khoản
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-PasswordHash').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    const [enriched] = await enrichUsersWithStats([user]);
    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Khóa / Mở khóa tài khoản người dùng
export const toggleLockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Không cho phép khóa tài khoản Quản trị viên (Admin)
    if (user.Role && user.Role.toLowerCase() === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Không thể khóa tài khoản Quản trị viên để bảo vệ quyền truy cập hệ thống!'
      });
    }

    const isCurrentlyLocked = user.Status?.toLowerCase() === 'locked';
    const newStatus = isCurrentlyLocked ? 'active' : 'locked';

    // Khi KHÓA: bắt buộc phải có lý do
    if (!isCurrentlyLocked) {
      const reason = req.body?.reason?.trim();
      if (!reason || reason.length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp lý do khóa tài khoản (tối thiểu 5 ký tự).'
        });
      }

      // Cập nhật trạng thái
      await User.findByIdAndUpdate(req.params.id, { $set: { Status: newStatus } }, { new: true });

      // Gửi email thông báo dạng văn bản thuần (plain text)
      const toEmail = user.Email;
      let emailSent = false;
      let emailErrorMsg = '';
      try {
        const lockTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
        await sendEmail(
          toEmail,
          '[VESTORA] Thông báo: Tài khoản của bạn đã bị khóa',
          buildLockEmailText(user, reason),
          buildLockEmailHtml(user, reason, lockTime)
        );
        emailSent = true;
      } catch (emailErr) {
        console.error('Gửi email khóa tài khoản thất bại:', emailErr.message);
        emailErrorMsg = emailErr.message;
      }

      return res.json({
        success: true,
        message: emailSent
          ? `Đã khóa tài khoản và gửi email thông báo tới ${toEmail}`
          : `Đã khóa tài khoản thành công (Lưu ý: Không gửi được email: ${emailErrorMsg})`,
        data: { id: user._id, Status: newStatus, Email: user.Email, FullName: user.FullName, emailSent }
      });
    }


    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { Status: newStatus } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Đã mở khóa tài khoản thành công',
      data: {
        id: updatedUser._id,
        Status: updatedUser.Status,
        Email: updatedUser.Email,
        FullName: updatedUser.FullName
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// Thống kê tổng hợp số lượng tài khoản cho Admin Dashboard & Accounts Console (dùng MongoDB Aggregation $facet tối ưu)
export const getUserStats = async (req, res) => {
  try {
    const userFacet = await User.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byRole: [{ $group: { _id: { $toLower: '$Role' }, count: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: { $toLower: '$Status' }, count: { $sum: 1 } } }],
        },
      },
    ]);

    const userRoles = {};
    (userFacet?.[0]?.byRole || []).forEach((r) => {
      if (r._id) userRoles[r._id] = r.count;
    });

    const userStatuses = {};
    (userFacet?.[0]?.byStatus || []).forEach((s) => {
      if (s._id) userStatuses[s._id] = s.count;
    });

    const total = userFacet?.[0]?.total?.[0]?.count || 0;
    const customers = userRoles.customer || 0;
    const admins = userRoles.admin || 0;
    const shopOwners = (userRoles.shopowner || 0) + (userRoles.shop_owner || 0);
    const staff = Math.max(0, total - customers - admins);
    const active = userStatuses.active || 0;
    const locked = userStatuses.locked || 0;

    res.json({
      success: true,
      data: {
        total,
        customers,
        shopOwners,
        admins,
        staff,
        active,
        locked,
        byRole: userRoles,
        users: {
          total,
          customers,
          staff,
          admins,
          active,
          locked,
        },
      },
    });
  } catch (error) {
    console.error('Error in getUserStats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo tài khoản mới từ Admin 
export const createUser = async (req, res) => {
  try {
    const { Email, FullName, Role, Password, Phone, Status, Avatar, DateOfBirth, Gender } = req.body;

    const validation = validateUserCreate(req.body);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      return res.status(400).json({ success: false, message: firstError, errors: validation.errors });
    }

    // Không cho phép tạo tài khoản có vai trò admin vì chỉ có 1 tài khoản admin duy nhất
    if (Role && Role.toLowerCase() === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Hệ thống chỉ duy trì 1 tài khoản Quản trị viên (Admin) duy nhất, không thể tạo thêm vai trò Admin!'
      });
    }

    // Chức năng này chỉ tạo tài khoản cho nhân viên / quản lý
    const cleanRole = (Role || '').toString().trim().toLowerCase().replace(/[_\s-]/g, '');
    if (cleanRole === 'customer') {
      return res.status(400).json({
        success: false,
        message: 'Chức năng này chỉ áp dụng tạo tài khoản cho nhân viên/quản lý'
      });
    }

    const existing = await User.findOne({ Email: Email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã tồn tại trong hệ thống' });
    }

    const rawPassword = Password || 'Vestora@2026';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const normalizeRole = (r) => {
      const clean = (r || '').toString().trim().toLowerCase().replace(/[_\s-]/g, '');
      if (clean === 'shopowner') return 'shopOwner';
      if (clean === 'brandmanager') return 'brandmanager';
      if (clean === 'warehousemanager') return 'warehouseManager';
      if (clean === 'warehousestaff') return 'warehousestaff';
      return clean || 'warehousestaff';
    };

    const newUser = new User({
      Email: Email.toLowerCase().trim(),
      FullName: FullName.trim(),
      Role: normalizeRole(Role),
      Status: (Status || 'active').toLowerCase(),
      PasswordHash: passwordHash,
      MustChangePassword: true,
      AuthProvider: 'local',
      Avatar: Avatar ? Avatar.trim() : '',
      DateOfBirth: DateOfBirth ? DateOfBirth.trim() : '',
      Gender: Gender ? Gender.trim() : '',
      Information: [{
        Phone: Phone ? Phone.trim() : ''
      }]
    });

    await newUser.save();

    // Gửi email chứa thông tin tài khoản và mật khẩu khởi tạo cho nhân viên
    let emailSent = false;
    let emailErrorMsg = '';
    try {
      await sendEmail(
        newUser.Email,
        '[VESTORA] Thông tin tài khoản nhân viên và mật khẩu đăng nhập',
        buildNewStaffEmailText(newUser, rawPassword)
      );
      emailSent = true;
    } catch (emailErr) {
      console.error('Gửi email thông tin tài khoản nhân viên thất bại:', emailErr.message);
      emailErrorMsg = emailErr.message;
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? `Đã tạo tài khoản nhân viên thành công và gửi mật khẩu tới ${newUser.Email}!`
        : `Đã tạo tài khoản thành công (Lưu ý: Không gửi được email: ${emailErrorMsg})`,
      data: {
        id: newUser._id,
        Email: newUser.Email,
        FullName: newUser.FullName,
        Role: newUser.Role,
        Status: newUser.Status,
        Avatar: newUser.Avatar,
        emailSent
      }
    });
  } catch (error) {
    console.error('Error in createUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật tài khoản từ Admin 
export const updateUser = async (req, res) => {
  try {
    const { FullName, Role, Status, Phone, Address, DateOfBirth, Gender, Avatar } = req.body;

    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Bảo vệ tài khoản Quản trị viên: Không cho phép chỉnh sửa tài khoản Admin
    const isTargetAdmin = existingUser.Role && existingUser.Role.toLowerCase() === 'admin';
    if (isTargetAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Hệ thống chỉ có 1 tài khoản Quản trị viên (Admin) duy nhất, không thể chỉnh sửa tài khoản này!'
      });
    }

    // Bảo vệ tài khoản Khách hàng: Không hỗ trợ chỉnh sửa tài khoản Customer qua trang quản lý này
    const isTargetCustomer = existingUser.Role && existingUser.Role.toLowerCase() === 'customer';
    if (isTargetCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản khách hàng (Customer) không hỗ trợ chỉnh sửa thông tin qua chức năng này!'
      });
    }

    // Không cho phép nâng cấp bất kỳ ai thành Admin hoặc chuyển thành Customer
    if (Role) {
      const cleanRole = Role.toString().trim().toLowerCase().replace(/[_\s-]/g, '');
      if (cleanRole === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Hệ thống chỉ duy trì 1 tài khoản Quản trị viên (Admin) duy nhất, không thể phân quyền vai trò này!'
        });
      }
      if (cleanRole === 'customer') {
        return res.status(400).json({
          success: false,
          message: 'Không thể chuyển vai trò của nhân viên thành Khách hàng (Customer)!'
        });
      }
    }

    // Validate dữ liệu đầu vào bằng reusable userValidation module
    const validation = validateUserUpdate(req.body);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      return res.status(400).json({
        success: false,
        message: firstError,
        errors: validation.errors
      });
    }

    const updateData = {};
    if (FullName !== undefined) {
      updateData.FullName = FullName.trim();
    }

    if (Role !== undefined) {
      const clean = Role.toString().trim().toLowerCase().replace(/[_\s-]/g, '');
      if (clean === 'shopowner') updateData.Role = 'shopOwner';
      else if (clean === 'brandmanager') updateData.Role = 'brandmanager';
      else if (clean === 'warehousemanager') updateData.Role = 'warehouseManager';
      else if (clean === 'warehousestaff') updateData.Role = 'warehousestaff';
    }

    if (Status !== undefined) {
      updateData.Status = Status.toLowerCase();
    }

    if (Avatar !== undefined) {
      updateData.Avatar = Avatar.trim();
    }

    if (DateOfBirth !== undefined) {
      updateData.DateOfBirth = DateOfBirth.trim();
    }

    if (Gender !== undefined) {
      updateData.Gender = Gender.trim();
    }

    if (Phone !== undefined || Address !== undefined) {
      const prevInfo = existingUser.Information?.[0] || {};
      updateData.Information = [{
        Phone: Phone !== undefined ? Phone.trim() : (prevInfo.Phone || ''),
        Address: Address !== undefined ? Address.trim() : (prevInfo.Address || '')
      }];
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-PasswordHash');

    res.json({
      success: true,
      message: 'Cập nhật thông tin tài khoản thành công',
      data: user
    });
  } catch (error) {
    console.error('Error in updateUser:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi cập nhật tài khoản' });
  }
};

// Đặt lại mật khẩu từ Admin , gửi email và yêu cầu đổi mật khẩu
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Bảo vệ tài khoản Quản trị viên
    const isTargetAdmin = user.Role && user.Role.toLowerCase() === 'admin';
    if (isTargetAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Không thể đặt lại mật khẩu cho tài khoản Quản trị viên (Admin) qua tính năng này!'
      });
    }

    // Không cho phép đặt lại mật khẩu đối với tài khoản đăng nhập Google
    const isGoogleAccount = (user.AuthProvider && user.AuthProvider.toLowerCase() === 'google') || Boolean(user.GoogleId);
    if (isGoogleAccount) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản đăng nhập bằng Google không hỗ trợ đặt lại mật khẩu qua hệ thống VESTORA!'
      });
    }

    // Không cho phép đặt lại mật khẩu đối với khách hàng (Customer)
    const cleanRole = (user.Role || '').toString().trim().toLowerCase().replace(/[_\s-]/g, '');
    if (cleanRole === 'customer') {
      return res.status(400).json({
        success: false,
        message: 'Chức năng đặt lại mật khẩu từ Quản trị viên chỉ áp dụng cho tài khoản nhân viên/quản trị, không áp dụng cho khách hàng (Customer)!'
      });
    }

    const rawPassword = (password || '').trim() || `Vestora@${Math.floor(1000 + Math.random() * 9000)}`;

    if (rawPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có tối thiểu 6 ký tự'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    user.PasswordHash = passwordHash;
    user.MustChangePassword = true;
    await user.save();

    // Gửi email thông báo mật khẩu mới và yêu cầu đổi mật khẩu
    let emailSent = false;
    try {
      const resetTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
      await sendEmail(
        user.Email,
        '[VESTORA] Thông báo đặt lại mật khẩu và yêu cầu đổi mật khẩu mới',
        buildResetPasswordEmailText(user, rawPassword),
        buildResetPasswordEmailHtml(user, rawPassword, resetTime)
      );
      emailSent = true;
    } catch (emailErr) {
      console.error('Gửi email đặt lại mật khẩu thất bại:', emailErr.message);
    }

    res.json({
      success: true,
      message: emailSent
        ? `Đã đặt lại mật khẩu và gửi email thành công tới ${user.Email}!`
        : `Đã đặt lại mật khẩu cho ${user.Email} (nhưng gửi email thông báo thất bại: hệ thống chưa kết nối SMTP)!`,
      data: {
        id: user._id,
        email: user.Email,
        mustChangePassword: true,
        emailSent
      }
    });
  } catch (error) {
    console.error('Error in resetUserPassword:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi hệ thống khi đặt lại mật khẩu' });
  }
};


