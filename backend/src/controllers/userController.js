import { User } from '../models/system/User.js';
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

    const newStatus = user.Status === 'locked' ? 'active' : 'locked';
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
    const { FullName, Role, Status, Phone } = req.body;
    const updateData = {};
    if (FullName) updateData.FullName = FullName.trim();
    if (Role) updateData.Role = Role.toLowerCase();
    if (Status) updateData.Status = Status.toLowerCase();
    if (Phone !== undefined) {
      updateData.Information = [{ Phone }];
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-PasswordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    res.json({
      success: true,
      message: 'Cập nhật thông tin tài khoản thành công',
      data: user
    });
  } catch (error) {
    console.error('Error in updateUser:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
