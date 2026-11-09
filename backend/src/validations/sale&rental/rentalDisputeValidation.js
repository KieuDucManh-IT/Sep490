/**
 * Rental Dispute Zod Validation Schemas
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-010
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-011
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-012
 */

import { z } from 'zod';
import { objectIdSchema } from './rentalOrderValidation.js';

export const createRentalDisputeSchema = z.object({
  rentalOrderId: objectIdSchema,
  reason: z.enum(
    [
      'damaged_in_transit',
      'manufacturing_defect',
      'wrong_item_or_color',
      'missing_accessories',
      'other',
    ],
    {
      errorMap: () => ({
        message:
          'Lý do khiếu nại không hợp lệ (hỗ trợ: damaged_in_transit, manufacturing_defect, wrong_item_or_color, missing_accessories, other)',
      }),
    }
  ),
  description: z
    .string()
    .trim()
    .min(10, 'Mô tả chi tiết lỗi phải có ít nhất 10 ký tự')
    .max(1000, 'Mô tả lỗi không vượt quá 1000 ký tự'),
  evidenceImages: z
    .array(z.string().url('Đường dẫn ảnh bằng chứng không hợp lệ'))
    .min(1, 'Bắt buộc tải lên ít nhất 1 hình ảnh bằng chứng khuyết tật sản phẩm'),
});

export const respondRentalDisputeSchema = z.object({
  disputeId: objectIdSchema,
  decision: z.enum(['approved', 'rejected'], {
    errorMap: () => ({
      message: 'Quyết định phản hồi CSKH phải là approved hoặc rejected',
    }),
  }),
  cskhNote: z
    .string()
    .trim()
    .min(5, 'Ghi chú phản hồi CSKH tối thiểu 5 ký tự')
    .max(500, 'Ghi chú tối đa 500 ký tự'),
});

export const kcsRentalDisputeSchema = z.object({
  disputeId: objectIdSchema,
  kcsResult: z.enum(['valid', 'invalid'], {
    errorMap: () => ({
      message: 'Kết quả thẩm định KCS phải là valid (hợp lệ) hoặc invalid (không hợp lệ)',
    }),
  }),
  refundMethod: z
    .enum(['wallet_balance', 'bank_transfer', 'member_points'])
    .default('wallet_balance'),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});
