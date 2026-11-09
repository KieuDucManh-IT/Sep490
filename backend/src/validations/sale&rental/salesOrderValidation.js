/**
 * Sales Order Zod Validation Schemas
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

export const salesOrderItemInputSchema = z.object({
  variantId: objectIdSchema,
  quantity: z.number().int().min(1, 'Số lượng mua tối thiểu là 1'),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export const shippingAddressSchema = z.object({
  receiverName: z.string().trim().min(1, 'Tên người nhận không được để trống'),
  phone: z.string().trim().min(8, 'Số điện thoại không hợp lệ').max(15, 'Số điện thoại không hợp lệ'),
  street: z.string().trim().min(1, 'Địa chỉ đường/nhà không được để trống'),
  ward: z.string().trim().optional().default(''),
  district: z.string().trim().optional().default(''),
  city: z.string().trim().min(1, 'Tỉnh/Thành phố không được để trống'),
});

export const createSalesOrderSchema = z.object({
  locationId: objectIdSchema,
  items: z
    .array(salesOrderItemInputSchema)
    .min(1, 'Đơn mua phải có ít nhất 1 sản phẩm'),
  paymentMethod: z
    .enum(['wallet', 'cod'])
    .default('cod'),
  shippingAddress: shippingAddressSchema,
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').nullish(),
});

export const updateSalesOrderStatusSchema = z.object({
  salesOrderId: objectIdSchema.optional(),
  orderStatus: z.enum(['confirmed', 'processing', 'shipped', 'completed', 'cancelled']),
  note: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});
