import * as cartValidationService from '../../services/cart/cartValidationService.js';
import { validateCartSchema } from '../../validations/cart/cartValidation.js';
export const validateCart = async (req, res, next) => {
  const parsed = validateCartSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, code: 'ERR_VALIDATION_FAILED', message: 'Dữ liệu giỏ hàng không hợp lệ.', errors: parsed.error.issues });
  try {
    const service = req.deps?.cartValidationService || cartValidationService;
    const data = await service.validateCartState(parsed.data);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, code: error.code, details: error.details });
    next(error);
  }
};
