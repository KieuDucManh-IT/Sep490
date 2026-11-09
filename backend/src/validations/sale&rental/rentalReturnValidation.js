/**
 * Rental Return Zod Validation Schemas
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-013
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-014
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-015
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-016
 */

import { z } from 'zod';
import { objectIdSchema } from './rentalOrderValidation.js';

export const returnItemInspectionSchema = z.object({
  itemId: objectIdSchema,
  conditionOnReturn: z.enum(
    ['new', 'good', 'worn', 'damaged', 'unrepairable'],
    {
      errorMap: () => ({
        message:
          'Tình trạng đồ phải là: new, good, worn, damaged hoặc unrepairable',
      }),
    }
  ),
  itemReturnStatus: z
    .enum(['accepted', 'damaged', 'missing_parts', 'rejected'], {
      errorMap: () => ({
        message:
          'Trạng thái tiếp nhận phải là: accepted, damaged, missing_parts hoặc rejected',
      }),
    })
    .default('accepted'),
  damageFee: z.number().min(0, 'Phí hư hại không được âm').default(0),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export const createRentalReturnSchema = z.object({
  rentalOrderId: objectIdSchema,
  receivedBy: objectIdSchema.optional(),
  items: z
    .array(returnItemInspectionSchema)
    .min(1, 'Biên bản trả đồ phải có ít nhất 1 hiện vật được kiểm tra'),
  lateFee: z.number().min(0, 'Phí trễ hạn không được âm').optional(),
  damageFee: z.number().min(0, 'Tổng phí hư hại không được âm').optional(),
  note: z.string().max(500, 'Ghi chú biên bản tối đa 500 ký tự').optional(),
});

export const settleDepositRefundSchema = z.object({
  rentalReturnId: objectIdSchema,
  overrideRefundAmount: z
    .number()
    .min(0, 'Số tiền hoàn không được âm')
    .optional(),
  settlementNote: z
    .string()
    .max(500, 'Ghi chú quyết toán tối đa 500 ký tự')
    .optional(),
});
