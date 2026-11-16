import { pricingService } from '../../services/masterdata/pricingService.js';

const errorStatus = (error) => (error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500);

export const updateProductPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { salePrice, rentalPricePerDay, deposit } = req.body || {};

    const result = await pricingService.updateProductPricing(id, { salePrice, rentalPricePerDay, deposit }, req.user);

    return res.json({
      success: true,
      message: 'Cập nhật bảng giá và tiền cọc thành công, sản phẩm đã được mở bán.',
      data: result.product,
    });
  } catch (error) {
    return res.status(errorStatus(error)).json({
      success: false,
      message: error.message || 'Lỗi hệ thống khi cập nhật bảng giá sản phẩm.',
    });
  }
};

/** GET /api/products/owner/pricing — danh sách định giá cho Shop Owner (gồm sản phẩm chưa định giá). */
export const getOwnerPricingProducts = async (req, res) => {
  try {
    const result = await pricingService.listOwnerPricingProducts(req.query || {});
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(errorStatus(error)).json({
      success: false,
      message: error.message || 'Lỗi khi lấy danh sách sản phẩm cần định giá.',
    });
  }
};
