import { z } from 'zod';
import { objectIdSchema } from '../sale&rental/salesOrderValidation.js';
import { appError as fail } from '../../services/warehouse/shared/errors.js';

const optionalNonNegativeIntOrEmpty = (label) =>
  z.any().refine(
    (val) => {
      if (val === undefined || val === null || val === '') return true;
      if (typeof val === 'boolean' || typeof val === 'object') return false;
      if (typeof val === 'string' && val.trim() === '') return false;
      const num = Number(val);
      return Number.isInteger(num) && num >= 0;
    },
    { message: `${label} không hợp lệ.` }
  ).optional();

const optionalPositiveMeasure = (label, max) =>
  z.any().refine(
    (val) => {
      if (val === undefined || val === null || val === '') return true;
      if (typeof val === 'boolean' || typeof val === 'object') return false;
      const num = Number(val);
      return Number.isFinite(num) && num > 0 && num <= max;
    },
    { message: `${label} phải lớn hơn 0 và không vượt quá ${max}.` }
  ).optional();

const optionalStringField = (label, max = 500) =>
  z.any().refine(
    (val) => val === undefined || val === null || (typeof val === 'string' && val.length <= max),
    { message: `${label} không hợp lệ (tối đa ${max} ký tự).` }
  ).optional();

const optionalIdLike = (label) =>
  z.any().refine(
    (val) => {
      if (val === undefined || val === null || val === '') return true;
      if (typeof val === 'boolean' || typeof val === 'object') return false;
      const num = Number(val);
      return Number.isInteger(num) && num > 0;
    },
    { message: `${label} không hợp lệ.` }
  ).optional();

const optionalCodeLike = (label) =>
  z.any().refine(
    (val) =>
      val === undefined ||
      val === null ||
      ((typeof val === 'string' || typeof val === 'number') && String(val).length <= 50),
    { message: `${label} không hợp lệ.` }
  ).optional();

export const calculateFeeSchema = z
  .object({
    orderType: z.enum(['sale', 'rental'], { message: 'Loại đơn hàng (orderType) phải là sale hoặc rental.' }).optional(),
    orderId: objectIdSchema.nullish(),
    toProvinceId: optionalIdLike('Mã Tỉnh/Thành'),
    toDistrictId: optionalIdLike('Mã Quận/Huyện'),
    toWardCode: optionalCodeLike('Mã Phường/Xã'),
    toProvinceName: optionalStringField('Tên Tỉnh/Thành', 150),
    toWardName: optionalStringField('Tên Phường/Xã', 150),
    isNewToAddress: z.boolean().optional(),
    weight: optionalPositiveMeasure('Khối lượng kiện hàng (gram)', 50000),
    length: optionalPositiveMeasure('Chiều dài kiện hàng (cm)', 200),
    width: optionalPositiveMeasure('Chiều rộng kiện hàng (cm)', 200),
    height: optionalPositiveMeasure('Chiều cao kiện hàng (cm)', 200),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (data.orderId && !data.orderType) {
      ctx.addIssue({
        code: 'custom',
        message: 'Loại đơn hàng (orderType) phải là sale hoặc rental.',
        path: ['orderType'],
      });
    }
  });

export const createOutboundSchema = z
  .object({
    orderType: z.enum(['sale', 'rental'], { message: 'Loại đơn hàng (orderType) phải là sale hoặc rental.' }),
    orderId: objectIdSchema,
    toName: optionalStringField('Tên người nhận', 150),
    toPhone: optionalStringField('Số điện thoại người nhận', 30),
    toAddress: optionalStringField('Địa chỉ nhận hàng', 500),
    toProvinceId: optionalIdLike('Mã Tỉnh/Thành'),
    toDistrictId: optionalIdLike('Mã Quận/Huyện'),
    toWardCode: optionalCodeLike('Mã Phường/Xã'),
    toProvinceName: optionalStringField('Tên Tỉnh/Thành', 150),
    toWardName: optionalStringField('Tên Phường/Xã', 150),
    isNewToAddress: z.boolean().optional(),
    weight: optionalPositiveMeasure('Khối lượng kiện hàng (gram)', 50000),
    length: optionalPositiveMeasure('Chiều dài kiện hàng (cm)', 200),
    width: optionalPositiveMeasure('Chiều rộng kiện hàng (cm)', 200),
    height: optionalPositiveMeasure('Chiều cao kiện hàng (cm)', 200),
    note: optionalStringField('Ghi chú giao hàng', 500),
    customCodAmount: optionalNonNegativeIntOrEmpty('Số tiền thu hộ COD'),
  })
  .passthrough();

export const validateShippingInput = (schema, rawInput) => {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw fail('Dữ liệu yêu cầu tạo/tính phí vận đơn không hợp lệ.', 400);
  }
  const result = schema.safeParse(rawInput);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).filter(Boolean).join('; ') || 'Dữ liệu đầu vào không hợp lệ.';
    throw fail(message, 400);
  }
  return result.data;
};
