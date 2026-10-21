import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';

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

    const newStatus = user.Status?.toLowerCase() === 'locked' ? 'active' : 'locked';
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { Status: newStatus } },
      { new: true }
    );

    res.json({
      success: true,
      message: `Đã ${newStatus === 'locked' ? 'khóa' : 'mở khóa'} tài khoản thành công`,
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
    const { Email, FullName, Role, Password, Phone, Status } = req.body;
    if (!Email || !FullName) {
      return res.status(400).json({ success: false, message: 'Email và họ tên không được để trống' });
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

    const newUser = new User({
      Email: Email.toLowerCase().trim(),
      FullName: FullName.trim(),
      Role: (Role || 'customer').toLowerCase(),
      Status: (Status || 'active').toLowerCase(),
      PasswordHash: passwordHash,
      AuthProvider: 'local',
      Information: Phone ? [{ Phone }] : []
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
        Status: newUser.Status
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
    const { FullName, Role, Status, Phone, Address } = req.body;

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

    const updateData = {};
    if (FullName !== undefined) {
      const trimmed = FullName.trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Họ và tên không được để trống' });
      }
      if ([...trimmed].length > 25) {
        return res.status(400).json({ success: false, message: 'Họ và tên không được vượt quá 25 ký tự' });
      }
      updateData.FullName = trimmed;
    }

    if (Role !== undefined) {
      updateData.Role = Role.toLowerCase();
    }

    if (Status !== undefined) {
      updateData.Status = Status.toLowerCase();
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

