import { z } from 'zod';
import { parseCalendarDate } from '../sale&rental/rentalOrderValidation.js';
const id = z.string().regex(/^[a-fA-F0-9]{24}$/);
const base = { cartItemId: z.string().max(200).optional(), productId: id.optional(), variantId: id, quantity: z.number().int().min(1).max(99) };
const price = z.number().finite().min(0).optional();
export const cartValidateSaleItemSchema = z.object({ ...base, clientSalePrice: price });
export const cartValidateRentalItemSchema = z.object({ ...base,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Boolean(parseCalendarDate(v))),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Boolean(parseCalendarDate(v))),
  clientRentalPricePerDay: price, clientDepositPerUnit: price,
});
export const validateCartSchema = z.object({
  locationId: id.nullish(),
  rentalItems: z.array(cartValidateRentalItemSchema).max(50).default([]),
  saleItems: z.array(cartValidateSaleItemSchema).max(50).default([]),
}).refine(v => v.rentalItems.length + v.saleItems.length > 0, 'Giỏ hàng phải có ít nhất 1 sản phẩm.')
  .refine(v => v.rentalItems.length + v.saleItems.length <= 50, 'Giỏ hàng tối đa 50 dòng.');
