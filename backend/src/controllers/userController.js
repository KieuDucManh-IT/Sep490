import { User } from '../models/system/User.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/sendEmail.js';
import { validateUserUpdate, validateUserCreate } from '../utils/userValidation.js';

// Mẫu email thông báo khóa tài khoản dạng văn bản thuần (plain text)
function buildLockEmailText(user, reason) {
  const name = user.FullName || user.Email;
  const lockTime = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false
  });

  return [
    'VESTORA',
    '--------------------------------------------------',
    `Xin chào ${name},`,
    '',
    `Tài khoản VESTORA của bạn vừa bị tạm khóa bởi Ban Quản trị vào lúc ${lockTime}.`,
    '',
    `Lý do khóa: ${reason}`,
    '',
    'Trong thời gian này, bạn sẽ tạm thời không thể đăng nhập hoặc thực hiện các hoạt động trên hệ thống VESTORA.',
    '',
    'Nếu cần hỗ trợ, vui lòng liên hệ CSKH:',
    '- Email: support@vestora.vn',
    '- Hotline: 1800-VESTORA',
    '',
    'Đây là thư tự động, vui lòng không trả lời.',
    '',
    'Trân trọng,',
    'Ban Quản trị VESTORA',
    '',
    '© VESTORA. All rights reserved.'
  ].join('\n');
}

// Mẫu email gửi thông tin tài khoản và mật khẩu khởi tạo cho nhân viên mới
function buildNewStaffEmailText(user, rawPassword) {
  const name = user.FullName || user.Email;
  const roleDisplayNames = {
    shopOwner: 'Chủ gian hàng (Shop Owner)',
    brandmanager: 'Quản lý thương hiệu (Brand Manager)',
    warehouseManager: 'Quản lý kho (Warehouse Manager)',
    warehousestaff: 'Nhân viên kho (Warehouse Staff)'
  };
  const roleName = roleDisplayNames[user.Role] || user.Role;

  return [
    'VESTORA',
    '--------------------------------------------------',
    `Xin chào ${name},`,
    '',
    'Tài khoản nhân viên của bạn đã được khởi tạo thành công trên hệ thống quản trị VESTORA.',
    '',
    'THÔNG TIN ĐĂNG NHẬP:',
    `- Địa chỉ Email: ${user.Email}`,
    `- Mật khẩu khởi tạo: ${rawPassword}`,
    `- Vai trò hệ thống: ${roleName}`,
    '',
    'LƯU Ý QUAN TRỌNG VỀ BẢO MẬT:',
    '• Vì lý do an toàn bảo mật thông tin, vui lòng đăng nhập và ĐỔI LẠI MẬT KHẨU ngay trong lần đầu tiên truy cập hệ thống.',
    '• Tuyệt đối không chia sẻ mật khẩu khởi tạo này cho bất kỳ ai khác.',
    '',
    'Nếu bạn cần hỗ trợ kỹ thuật hoặc có bất kỳ thắc mắc nào, vui lòng liên hệ:',
    '- Email hỗ trợ: support@vestora.vn',
    '- Hotline: 1800-VESTORA',
    '',
    'Đây là thư tự động, vui lòng không trả lời trực tiếp email này.',
    '',
    'Trân trọng,',
    'Ban Quản trị VESTORA',
    '',
    '© VESTORA. All rights reserved.'
  ].join('\n');
}

// Mẫu email thông báo đặt lại mật khẩu cho người dùng và yêu cầu đổi mật khẩu
function buildResetPasswordEmailText(user, newPassword) {
  const name = user.FullName || user.Email;
  const resetTime = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false
  });

  return [
    'VESTORA',
    '--------------------------------------------------',
    `Xin chào ${name},`,
    '',
    `Mật khẩu tài khoản VESTORA của bạn vừa được Quản trị viên đặt lại vào lúc ${resetTime}.`,
    '',
    'THÔNG TIN ĐĂNG NHẬP MỚI:',
    `- Địa chỉ Email: ${user.Email}`,
    `- Mật khẩu mới (tạm thời): ${newPassword}`,
    '',
    'LƯU Ý QUAN TRỌNG VỀ BẢO MẬT (BẮT BUỘC):',
    '• Đây là mật khẩu tạm thời do Quản trị viên hệ thống cấp.',
    '• Vì lý do an toàn bảo mật, bạn BẮT BUỘC phải đăng nhập và ĐỔI LẠI MẬT KHẨU ngay khi truy cập hệ thống.',
    '• Tuyệt đối không chia sẻ mật khẩu tạm thời này cho bất kỳ ai khác.',
    '',
    'Nếu bạn không yêu cầu hoặc có thắc mắc, vui lòng liên hệ ngay với Ban Quản trị VESTORA:',
    '- Email hỗ trợ: support@vestora.vn',
    '- Hotline: 1800-VESTORA',
    '',
    'Đây là thư tự động, vui lòng không trả lời trực tiếp email này.',
    '',
    'Trân trọng,',
    'Ban Quản trị VESTORA',
    '',
    '© VESTORA. All rights reserved.'
  ].join('\n');
}

// Lấy danh sách tài khoản
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
      .select('-PasswordHash') // Không trả về mật khẩu
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error in getUsers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Chi tiết tài khoản
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-PasswordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    res.json({ success: true, data: user });
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
        message: 'Không thể khóa tài khoản Quản trị viên (Admin) để bảo vệ quyền truy cập hệ thống!'
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
      try {
        await sendEmail(
          toEmail,
          '[VESTORA] Thông báo: Tài khoản của bạn đã bị khóa',
          buildLockEmailText(user, reason)
        );
      } catch (emailErr) {
        console.error('Gửi email khóa tài khoản thất bại:', emailErr.message);
        // Không throw — vẫn trả về thành công dù email lỗi
      }

      return res.json({
        success: true,
        message: `Đã khóa tài khoản và gửi email thông báo tới ${toEmail}`,
        data: { id: user._id, Status: newStatus, Email: user.Email, FullName: user.FullName }
      });
    }

    // Khi MỞ KHÓA: không cần lý do, không cần email
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


// Thống kê người dùng cho Admin Dashboard
export const getUserStats = async (req, res) => {
  try {
    const total = await User.countDocuments();
    const customers = await User.countDocuments({ Role: { $regex: /^customer$/i } });
    const shopOwners = await User.countDocuments({ Role: { $regex: /^shop_owner$/i } });
    const admins = await User.countDocuments({ Role: { $regex: /^admin$/i } });
    const active = await User.countDocuments({ Status: { $regex: /^active$/i } });
    const locked = await User.countDocuments({ Status: { $regex: /^locked$/i } });

    res.json({
      success: true,
      data: {
        total,
        customers,
        shopOwners,
        admins,
        active,
        locked
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tạo tài khoản mới từ Admin Console
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

    // Chức năng này chỉ tạo tài khoản cho nhân viên / quản lý, không áp dụng cho khách hàng (customer)
    const cleanRole = (Role || '').toString().trim().toLowerCase().replace(/[_\s-]/g, '');
    if (cleanRole === 'customer') {
      return res.status(400).json({
        success: false,
        message: 'Chức năng này chỉ áp dụng tạo tài khoản cho nhân viên/quản lý, không tạo tài khoản khách hàng (customer)!'
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
        Phone: Phone ? Phone.trim() : '',
        DateOfBirth: DateOfBirth ? DateOfBirth.trim() : '',
        Gender: Gender ? Gender.trim() : ''
      }]
    });

    await newUser.save();

    // Gửi email chứa thông tin tài khoản và mật khẩu khởi tạo cho nhân viên
    try {
      await sendEmail(
        newUser.Email,
        '[VESTORA] Thông tin tài khoản nhân viên và mật khẩu đăng nhập',
        buildNewStaffEmailText(newUser, rawPassword)
      );
    } catch (emailErr) {
      console.error('Gửi email thông tin tài khoản nhân viên thất bại:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Đã tạo tài khoản nhân viên thành công và gửi mật khẩu tới ${newUser.Email}!`,
      data: {
        id: newUser._id,
        Email: newUser.Email,
        FullName: newUser.FullName,
        Role: newUser.Role,
        Status: newUser.Status,
        Avatar: newUser.Avatar
      }
    });
  } catch (error) {
    console.error('Error in createUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật tài khoản từ Admin Console
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

    if (Phone !== undefined || Address !== undefined || DateOfBirth !== undefined || Gender !== undefined) {
      const prevInfo = existingUser.Information?.[0] || {};
      updateData.Information = [{
        Phone: Phone !== undefined ? Phone.trim() : (prevInfo.Phone || ''),
        Address: Address !== undefined ? Address.trim() : (prevInfo.Address || ''),
        DateOfBirth: DateOfBirth !== undefined ? DateOfBirth.trim() : (prevInfo.DateOfBirth || ''),
        Gender: Gender !== undefined ? Gender.trim() : (prevInfo.Gender || '')
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

// Đặt lại mật khẩu từ Admin Console, gửi email và yêu cầu đổi mật khẩu
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
      await sendEmail(
        user.Email,
        '[VESTORA] Thông báo đặt lại mật khẩu và yêu cầu đổi mật khẩu mới',
        buildResetPasswordEmailText(user, rawPassword)
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


