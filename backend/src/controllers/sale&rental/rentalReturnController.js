/**
 * Rental Return Controller
 * Nghiệm thu KCS & Quyết toán cọc
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-013..REQ-RENT-017
 */

import * as rentalReturnService from '../../services/sale&rental/rentalReturnService.js';
import { RentalReturn } from '../../models/sale&rental/RentalReturn.js';
import { RentalReturnDetail } from '../../models/sale&rental/RentalReturnDetail.js';

export const createReturn = async (req, res, next) => {
  const service = req?.deps?.rentalReturnService || rentalReturnService;
  try {
    const { id: rentalOrderId } = req.params;
    const { items, note } = req.body;

    const result = await service.createReturnReceiptAndSettle({
      rentalOrderId,
      receivedBy: req.user?._id,
      items,
      note,
    });

    return res.status(201).json({
      success: true,
      message: result.message,
      data: result.rentalReturn,
      settlementSummary: result.settlementSummary,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const getReturnById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const returnReceipt = await RentalReturn.findById(id)
      .populate('rentalOrderId')
      .populate('receivedBy', 'name phone email')
      .lean();

    if (!returnReceipt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy biên bản trả đồ',
      });
    }

    const details = await RentalReturnDetail.find({ rentalReturnId: id })
      .populate('itemId')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...returnReceipt,
        details,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};
