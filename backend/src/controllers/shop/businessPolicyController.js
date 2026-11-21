import mongoose from 'mongoose';
import { BusinessPolicy } from '../../models/shop/BusinessPolicy.js';

const escapeRegex = (str = '') => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

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
 * TẠO CHÍNH SÁCH MỚI (CREATE POLICY)
 * POST /api/shops/policies
 */
export const createPolicy = async (req, res) => {
  try {
    const { title, summary, content, isActive } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên chính sách.',
      });
    }

    const cleanTitle = title.trim();
    const duplicate = await BusinessPolicy.findOne({
      title: { $regex: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i') },
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `Chính sách có tên "${cleanTitle}" đã tồn tại trong hệ thống.`,
      });
    }

    const newPolicy = await BusinessPolicy.create({
      title: cleanTitle.slice(0, 200),
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
      const seenTitles = new Set();
      // Validate toàn bộ tên chính sách không được để trống và không được trùng nhau
      for (let idx = 0; idx < policiesList.length; idx++) {
        const item = policiesList[idx];
        const clean = String(item.title || '').trim().toLowerCase();
        if (!clean) {
          return res.status(400).json({
            success: false,
            message: `Tên chính sách (mục số ${idx + 1}) không được để trống.`,
          });
        }
        if (seenTitles.has(clean)) {
          return res.status(400).json({
            success: false,
            message: `Tên chính sách "${String(item.title).trim()}" bị trùng lặp trong danh mục.`,
          });
        }
        seenTitles.add(clean);
      }

      for (let idx = 0; idx < policiesList.length; idx++) {
        const item = policiesList[idx];
        const policyId = item._id || item.id || item.key;
        if (!policyId) continue;

        const isOid = mongoose.Types.ObjectId.isValid(policyId);
        const updateData = {
          title: String(item.title).trim().slice(0, 200),
          summary: typeof item.summary === 'string' ? item.summary.trim().slice(0, 500) : item.summary,
          content: typeof item.content === 'string' ? item.content.trim() : item.content,
          isActive: item.isActive !== false,
        };

        if (isOid) {
          await BusinessPolicy.findByIdAndUpdate(policyId, { $set: updateData });
        } else {
          await BusinessPolicy.findOneAndUpdate({ key: policyId }, { $set: updateData });
        }
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
 * Cập nhật một chính sách cụ thể theo ID hoặc key cũ
 * PUT /api/shops/policies/:key
 */
export const updatePolicyByKey = async (req, res) => {
  try {
    const { key } = req.params;
    const { title, summary, content, isActive } = req.body;

    const isOid = mongoose.Types.ObjectId.isValid(key);
    const filter = isOid ? { _id: key } : { key };

    const updateFields = {};
    if (title !== undefined) {
      const cleanTitle = typeof title === 'string' ? title.trim() : '';
      if (!cleanTitle) {
        return res.status(400).json({
          success: false,
          message: 'Tên chính sách không được để trống.',
        });
      }

      const duplicate = await BusinessPolicy.findOne({
        title: { $regex: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i') },
        ...(isOid ? { _id: { $ne: key } } : { key: { $ne: key } }),
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Chính sách có tên "${cleanTitle}" đã tồn tại. Vui lòng chọn tên khác.`,
        });
      }

      updateFields.title = cleanTitle.slice(0, 200);
    }
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
 * XÓA CHÍNH SÁCH
 * DELETE /api/shops/policies/:key
 */
export const deletePolicy = async (req, res) => {
  try {
    const { key: policyId } = req.params;
    if (!policyId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu định danh chính sách cần xóa.',
      });
    }

    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(policyId)) {
      deleted = await BusinessPolicy.findByIdAndDelete(policyId);
    }
    if (!deleted) {
      deleted = await BusinessPolicy.findOneAndDelete({ key: policyId });
    }

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
