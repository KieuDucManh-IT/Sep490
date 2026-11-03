import { pricingService } from '../../services/masterdata/pricingService.js';

export const updateProductPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { salePrice, rentalPricePerDay, deposit } = req.body;

    const result = await pricingService.updateProductPricing(id, {
      salePrice,
      rentalPricePerDay,
      deposit,
    });

    return res.json({
      success: true,
      message: 'Cập nhật bảng giá và tiền cọc thành công, đã đồng bộ sang các biến thể.',
      data: result.product,
      syncedVariantsCount: result.syncedVariantsCount,
    });
  } catch (error) {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;

    return res.status(status).json({
      success: false,
      message: error.message || 'Lỗi hệ thống khi cập nhật bảng giá sản phẩm.',
    });
  }
};
