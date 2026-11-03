import mongoose from 'mongoose';
import { BusinessPolicy } from '../../models/shop/BusinessPolicy.js';

/**
 * Trợ giúp chuyển chuỗi tiếng Việt thành slug/key an toàn
 */
export function slugify(text = '') {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Lấy danh sách toàn bộ chính sách kinh doanh của toàn chuỗi VESTORA (Dành cho Shop Owner)
 * GET /api/shops/policies/my-policy
 */
export const getMyPolicy = async (req, res) => {
  try {
    const policies = await BusinessPolicy.find()
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: policies,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể tải danh sách chính sách kinh doanh chuỗi.',
    });
  }
};

/**
 * TẠO CHÍNH SÁCH MỚI (CREATE POLICY - Thêm 1 document vào collection)
 * POST /api/shops/policies
 */
export const createPolicy = async (req, res) => {
  try {
    const { title, summary, content, isActive, key } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên chính sách.',
      });
    }

    let generatedKey = key ? slugify(key) : slugify(title);
    if (!generatedKey) generatedKey = `policy-${Date.now()}`;

    // Đảm bảo không trùng key trong toàn hệ thống
    const existing = await BusinessPolicy.findOne({ key: generatedKey });
    if (existing) {
      generatedKey = `${generatedKey}-${Date.now().toString().slice(-4)}`;
    }

    const newPolicy = await BusinessPolicy.create({
      title: title.trim().slice(0, 200),
      key: generatedKey,
      summary: typeof summary === 'string' ? summary.trim().slice(0, 500) : '',
      content: typeof content === 'string' ? content.trim() : '',
      isActive: isActive !== false,
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo chính sách mới thành công.',
      data: newPolicy,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể tạo chính sách mới.',
    });
  }
};

/**
 * Cập nhật danh sách chính sách kinh doanh của toàn chuỗi (Dành cho Shop Owner)
 * PUT /api/shops/policies/my-policy
 */
export const updateMyPolicy = async (req, res) => {
  try {
    const policiesList = Array.isArray(req.body)
      ? req.body
      : req.body?.policies && Array.isArray(req.body.policies)
      ? req.body.policies
      : [];

    if (policiesList.length > 0) {
      for (let idx = 0; idx < policiesList.length; idx++) {
        const item = policiesList[idx];
        const searchKey = item.key || (item._id && String(item._id));
        if (!searchKey) continue;

        const updateData = {
          title: typeof item.title === 'string' ? item.title.trim().slice(0, 200) : item.title,
          summary: typeof item.summary === 'string' ? item.summary.trim().slice(0, 500) : item.summary,
          content: typeof item.content === 'string' ? item.content.trim() : item.content,
          isActive: item.isActive !== false,
        };

        await BusinessPolicy.findOneAndUpdate(
          {
            $or: [
              { key: searchKey },
              ...(mongoose.Types.ObjectId.isValid(searchKey) ? [{ _id: searchKey }] : []),
            ],
          },
          { $set: updateData }
        );
      }
    }

    const updatedPolicies = await BusinessPolicy.find()
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      message: 'Cập nhật chính sách kinh doanh toàn chuỗi thành công.',
      data: updatedPolicies,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể cập nhật chính sách kinh doanh.',
    });
  }
};

/**
 * Cập nhật một chính sách cụ thể theo key hoặc _id
 * PUT /api/shops/policies/:key
 */
export const updatePolicyByKey = async (req, res) => {
  try {
    const { key } = req.params;
    const { title, summary, content, isActive } = req.body;

    const isOid = mongoose.Types.ObjectId.isValid(key);
    const filter = {
      $or: [{ key }, ...(isOid ? [{ _id: key }] : [])],
    };

    const updateFields = {};
    if (typeof title === 'string') updateFields.title = title.trim().slice(0, 200);
    if (typeof summary === 'string') updateFields.summary = summary.trim().slice(0, 500);
    if (typeof content === 'string') updateFields.content = content.trim();
    if (typeof isActive === 'boolean') updateFields.isActive = isActive;

    const updated = await BusinessPolicy.findOneAndUpdate(
      filter,
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chính sách cần cập nhật.',
      });
    }

    return res.json({
      success: true,
      message: 'Cập nhật chính sách thành công.',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể cập nhật chính sách.',
    });
  }
};

/**
 * XÓA CHÍNH SÁCH (DELETE POLICY - Xóa 1 document khỏi collection)
 * DELETE /api/shops/policies/:key
 */
export const deletePolicy = async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu mã định danh chính sách cần xóa.',
      });
    }

    const isOid = mongoose.Types.ObjectId.isValid(key);
    const deleted = await BusinessPolicy.findOneAndDelete({
      $or: [{ key }, ...(isOid ? [{ _id: key }] : [])],
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chính sách cần xóa.',
      });
    }

    const remaining = await BusinessPolicy.find()
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      message: 'Xóa chính sách thành công.',
      data: remaining,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể xóa chính sách.',
    });
  }
};

/**
 * Lấy danh sách chính sách công khai để hiển thị trên Cổng Khách Hàng
 * GET /api/shops/policies/public
 */
export const getPublicPolicies = async (req, res) => {
  try {
    const activePolicies = await BusinessPolicy.find({ isActive: true })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: activePolicies,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Không thể tải chính sách hoạt động.',
    });
  }
};
