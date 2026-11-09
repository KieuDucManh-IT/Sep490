/**
 * Rental Order Zod Validation Schemas
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-001
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-002
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-006
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-007
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-018
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-019
 */

import { z } from 'zod';

export const objectIdSchema = z
  .any()
  .refine(
    (val) => {
      if (!val) return false;
      const str = String(val).trim();
      return /^[0-9a-fA-F]{24}$/.test(str);
    },
    { message: 'Mã ObjectId không hợp lệ' }
  )
  .transform((val) => String(val).trim());

export const shippingAddressSchema = z.object({
  receiverName: z.string().trim().min(1, 'Tên người nhận không được để trống'),
  phone: z.string().trim().min(8, 'Số điện thoại không hợp lệ').max(15, 'Số điện thoại không hợp lệ'),
  street: z.string().trim().min(1, 'Địa chỉ đường/nhà không được để trống'),
  ward: z.string().trim().optional().default(''),
  district: z.string().trim().optional().default(''),
  city: z.string().trim().min(1, 'Tỉnh/Thành phố không được để trống'),
  provinceId: z.number().int().nullish(),
  districtId: z.number().int().nullish(),
  wardCode: z.string().trim().nullish(),
});

export const rentalOrderItemInputSchema = z.object({
  variantId: objectIdSchema,
  quantity: z.number().int().min(1, 'Số lượng thuê tối thiểu là 1'),
  unitRentalFee: z.number().min(0, 'Đơn giá thuê không được âm').optional(),
  depositPerUnit: z.number().min(0, 'Tiền cọc không được âm').optional(),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export const createRentalOrderSchema = z
  .object({
    locationId: objectIdSchema,
    startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    items: z
      .array(rentalOrderItemInputSchema)
      .min(1, 'Đơn thuê phải có ít nhất 1 sản phẩm'),
    note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').nullish(),
    shippingAddress: z
      .union([shippingAddressSchema, z.record(z.string(), z.any()), z.string()])
      .nullish(),
    paymentMethod: z
      .enum(['wallet', 'payos', 'cash'])
      .default('wallet'),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate).getTime();
      const due = new Date(data.dueDate).getTime();
      return !isNaN(start) && !isNaN(due) && due > start;
    },
    {
      message: 'Ngày trả đồ (dueDate) phải sau ngày nhận đồ (startDate)',
      path: ['dueDate'],
    }
  );

export const assignPhysicalItemsSchema = z.object({
  rentalOrderId: objectIdSchema,
  assignments: z
    .array(
      z.object({
        rentalOrderDetailId: objectIdSchema,
        itemIds: z
          .array(objectIdSchema)
          .min(1, 'Cần chỉ định ít nhất 1 hiện vật kho (barcode/itemId)'),
      })
    )
    .min(1, 'Danh sách gán hiện vật không được rỗng'),
});

export const handoverOrderSchema = z.object({
  rentalOrderId: objectIdSchema,
  note: z.string().max(500).optional(),
});

export const cancelRentalOrderSchema = z.object({
  rentalOrderId: objectIdSchema,
  cancelReason: z
    .string()
    .trim()
    .min(3, 'Lý do hủy đơn tối thiểu 3 ký tự')
    .max(500, 'Lý do hủy đơn tối đa 500 ký tự'),
});
