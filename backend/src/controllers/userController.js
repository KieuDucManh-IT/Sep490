import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/sendEmail.js';
import { validateUserUpdate, validateUserCreate } from '../utils/userValidation.js';

// Template email thông báo khóa tài khoản
function buildLockEmailHtml(fullName, reason) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Thông báo tài khoản bị khóa - VESTORA</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1E293B;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1E293B 0%,#0F172A 100%);padding:36px 40px;border-bottom:2px solid #C5A880;text-align:center;">
            <div style="font-size:28px;font-weight:800;letter-spacing:4px;color:#C5A880;">VESTORA</div>
            <div style="font-size:11px;color:#94A3B8;letter-spacing:2px;margin-top:4px;">HỆ THỐNG QUẢN LÝ TÀI KHOẢN</div>
          </td>
        </tr>
        <!-- Alert Icon -->
        <tr>
          <td style="padding:36px 40px 0;text-align:center;">
            <div style="display:inline-block;width:64px;height:64px;background:rgba(239,68,68,0.15);border-radius:50%;line-height:64px;font-size:28px;">🔒</div>
            <h1 style="color:#F1F5F9;font-size:22px;font-weight:700;margin:16px 0 8px;">Tài Khoản Của Bạn Đã Bị Khóa</h1>
            <p style="color:#94A3B8;font-size:14px;margin:0;">Xin chào <strong style="color:#C5A880;">${fullName}</strong>,</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:24px 40px;">
            <p style="color:#CBD5E1;font-size:14px;line-height:1.7;margin:0 0 20px;">
              Chúng tôi thông báo rằng tài khoản VESTORA liên kết với địa chỉ email này đã bị <strong style="color:#EF4444;">tạm khóa</strong> bởi bộ phận quản trị hệ thống.
            </p>
            <!-- Reason Box -->
            <div style="background:#0F172A;border-left:4px solid #EF4444;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
              <div style="color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Lý do khóa tài khoản</div>
              <div style="color:#F1F5F9;font-size:15px;font-weight:500;line-height:1.6;">${reason}</div>
            </div>
            <p style="color:#CBD5E1;font-size:13px;line-height:1.7;margin:0 0 12px;">
              Trong thời gian tài khoản bị khóa, bạn sẽ không thể đăng nhập hoặc sử dụng các dịch vụ của VESTORA.
            </p>
            <p style="color:#CBD5E1;font-size:13px;line-height:1.7;margin:0;">
              Nếu bạn cho rằng đây là sự nhầm lẫn hoặc muốn khiếu nại, vui lòng liên hệ bộ phận hỗ trợ.
            </p>
          </td>
        </tr>
        <!-- Contact -->
        <tr>
          <td style="padding:0 40px 36px;">
            <div style="background:rgba(197,168,128,0.08);border:1px solid rgba(197,168,128,0.2);border-radius:10px;padding:18px 20px;text-align:center;">
              <div style="color:#C5A880;font-size:12px;font-weight:600;margin-bottom:6px;">📧 HỖ TRỢ KHIẾU NẠI</div>
              <div style="color:#94A3B8;font-size:12px;">support@vestora.vn &nbsp;|&nbsp; Hotline: 1800-VESTORA</div>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0F172A;padding:20px 40px;text-align:center;border-top:1px solid #1E293B;">
            <p style="color:#475569;font-size:11px;margin:0;">Email tự động từ hệ thống VESTORA. Vui lòng không trả lời email này.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

      // Gửi email thông báo (không block response nếu email lỗi)
      const fullName = user.FullName || user.Email;
      const toEmail = user.Email;
      try {
        await sendEmail(
          toEmail,
          ' [VESTORA] Tài khoản của bạn đã bị khóa',
          `Xin chào ${fullName},\n\nTài khoản VESTORA của bạn đã bị khóa.\nLý do: ${reason}\n\nNếu có thắc mắc, vui lòng liên hệ support@vestora.vn.`,
          buildLockEmailHtml(fullName, reason)
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

    const existing = await User.findOne({ Email: Email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã tồn tại trong hệ thống' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(Password || 'Vestora@2026', salt);

    const normalizeRole = (r) => {
      const clean = (r || 'customer').toString().trim().toLowerCase().replace(/[_\s-]/g, '');
      if (clean === 'admin') return 'admin';
      if (clean === 'shopowner') return 'shopOwner';
      if (clean === 'brandmanager') return 'brandmanager';
      if (clean === 'warehousemanager') return 'warehouseManager';
      if (clean === 'warehousestaff') return 'warehousestaff';
      return 'customer';
    };

    const newUser = new User({
      Email: Email.toLowerCase().trim(),
      FullName: FullName.trim(),
      Role: normalizeRole(Role),
      Status: (Status || 'active').toLowerCase(),
      PasswordHash: passwordHash,
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
    res.status(201).json({
      success: true,
      message: 'Tạo tài khoản người dùng thành công',
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

    // Không cho phép nâng cấp bất kỳ ai thành Admin
    if (Role && Role.toLowerCase() === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Hệ thống chỉ duy trì 1 tài khoản Quản trị viên (Admin) duy nhất, không thể phân quyền vai trò này!'
      });
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
      else if (clean === 'admin') updateData.Role = 'admin';
      else updateData.Role = 'customer';
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

