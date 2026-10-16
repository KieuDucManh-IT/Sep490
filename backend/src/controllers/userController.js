import { User } from '../models/User.js';

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
