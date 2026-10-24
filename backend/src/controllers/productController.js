import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  updateProduct
} from '../services/productService.js';
import {
  validateCreateProduct,
  validateObjectId,
  validateProductListQuery,
  validateUpdateProduct
} from '../validations/productValidation.js';

//duc 2026-10-15: Chuẩn hóa lỗi validation để controller trả response HTTP nhất quán.
const sendError = (res, error) => {
  const status = error.statusCode || 500;
  res.status(status).json({ success: false, message: error.message });
};

//duc 2026-10-15: Lấy danh sách sản phẩm thuộc shop đang được cấu hình cho shop owner.
export const listShopProducts = async (req, res) => {
  try {
    const query = validateProductListQuery(req.query);
    const result = await getProducts(query);
    res.json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-15: Lấy chi tiết một sản phẩm và giới hạn theo shop hiện tại.
export const getShopProduct = async (req, res) => {
  try {
    validateObjectId(req.params.id, 'productId');
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, data: product });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-15: Kiểm tra dữ liệu request trước khi giao nghiệp vụ tạo sản phẩm cho service.
export const createShopProduct = async (req, res) => {
  try {
    const input = validateCreateProduct(req.body);
    const product = await createProduct(input);
    res.status(201).json({ success: true, message: 'Tạo sản phẩm thành công', data: product });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-15: Cập nhật có chọn lọc sản phẩm thuộc shop, không cho sửa shopId hoặc trạng thái duyệt.
export const updateShopProduct = async (req, res) => {
  try {
    validateObjectId(req.params.id, 'productId');
    const input = validateUpdateProduct(req.body);
    const product = await updateProduct(req.params.id, input);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, message: 'Cập nhật sản phẩm thành công', data: product });
  } catch (error) {
    sendError(res, error);
  }
};

//duc 2026-10-15: Xóa mềm sản phẩm để giữ lại dữ liệu liên quan trong đơn hàng.
export const deleteShopProduct = async (req, res) => {
  try {
    validateObjectId(req.params.id, 'productId');
    const product = await deleteProduct(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, message: 'Xóa sản phẩm thành công', data: product });
  } catch (error) {
    sendError(res, error);
  }
};
