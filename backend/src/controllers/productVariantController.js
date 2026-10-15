import {
  createProductVariant,
  deleteProductVariant,
  getProductVariantById,
  getProductVariants,
  updateProductVariant
} from '../services/productVariantService.js';
import {
  validateProductVariantFields,
  validateVariantObjectIds
} from '../validations/productVariantValidation.js';

//duc 2026-10-15: Trả lỗi validation và nghiệp vụ theo HTTP status chuẩn hóa.
const sendError = (res, error) => res.status(error.statusCode || 500).json({
  success: false,
  message: error.message
});

//duc 2026-10-15: Liệt kê variant thuộc một product của shop hiện tại.
export const listProductVariants = async (req, res) => {
  try {
    validateVariantObjectIds(req.params.productId);
    const variants = await getProductVariants(req.params.productId);
    if (!variants) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, count: variants.length, data: variants });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-15: Lấy chi tiết variant trong product được shop sở hữu.
export const getProductVariant = async (req, res) => {
  try {
    validateVariantObjectIds(req.params.productId, req.params.variantId);
    const variant = await getProductVariantById(req.params.productId, req.params.variantId);
    if (!variant) return res.status(404).json({ success: false, message: 'Không tìm thấy variant' });
    res.json({ success: true, data: variant });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-15: Kiểm tra trường bắt buộc trước khi tạo variant cho product.
export const createProductVariantForProduct = async (req, res) => {
  try {
    validateVariantObjectIds(req.params.productId);
    const input = validateProductVariantFields(req.body);
    const variant = await createProductVariant(req.params.productId, input);
    if (!variant) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.status(201).json({ success: true, message: 'Tạo variant thành công', data: variant });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-15: Cập nhật một phần các thuộc tính variant, cho phép body rỗng theo validation chung.
export const updateProductVariantForProduct = async (req, res) => {
  try {
    validateVariantObjectIds(req.params.productId, req.params.variantId);
    const input = validateProductVariantFields(req.body, { partial: true });
    const variant = await updateProductVariant(req.params.productId, req.params.variantId, input);
    if (!variant) return res.status(404).json({ success: false, message: 'Không tìm thấy product hoặc variant' });
    res.json({ success: true, message: 'Cập nhật variant thành công', data: variant });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-15: Xóa mềm variant và giữ lại lịch sử liên kết với product.
export const deleteProductVariantForProduct = async (req, res) => {
  try {
    validateVariantObjectIds(req.params.productId, req.params.variantId);
    const variant = await deleteProductVariant(req.params.productId, req.params.variantId);
    if (!variant) return res.status(404).json({ success: false, message: 'Không tìm thấy product hoặc variant' });
    res.json({ success: true, message: 'Xóa variant thành công', data: variant });
  } catch (error) {
    sendError(res, error);
  }
};
