import { Category } from '../models/Category.js';

//duc 2026-10-16: Trả lỗi chuẩn HTTP cho mọi thao tác category.
const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({ success: false, message: error.message });

//duc 2026-10-16: Lấy danh sách category đang active để shop chọn khi tạo/sửa sản phẩm.
export const listCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: false }).sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-16: Tạo category mới.
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc' });
    const category = await Category.create({ name: name.trim(), description });
    res.status(201).json({ success: true, message: 'Tạo danh mục thành công', data: category });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-16: Cập nhật category theo id.
export const updateCategory = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: { ...(name ? { name: name.trim() } : {}), ...(description !== undefined ? { description } : {}), ...(status ? { status } : {}) } },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    res.json({ success: true, message: 'Cập nhật danh mục thành công', data: category });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-16: Xóa mềm category.
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: { isDeleted: true } }, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    res.json({ success: true, message: 'Xóa danh mục thành công' });
  } catch (error) {
    sendError(res, error);
  }
};
