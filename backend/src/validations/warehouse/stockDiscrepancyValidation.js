import { z } from 'zod';

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });
const objectId = (label) => z.string({ error: `${label} không hợp lệ.` }).regex(/^[a-f\d]{24}$/i, `${label} không hợp lệ.`);

export const responsibleParties = ['central_warehouse', 'branch', 'carrier', 'unknown'];
export const discrepancyStatuses = ['open', 'partially_resolved', 'resolved'];

const resolveSchema = z.object({
  outcome: z.enum(['found', 'lost'], { error: 'Chọn kết luận: tìm thấy hoặc mất.' }),
  quantity: z.number({ error: 'Số lượng kết luận phải là số nguyên từ 1 trở lên.' }).int('Số lượng kết luận phải là số nguyên từ 1 trở lên.').min(1, 'Số lượng kết luận phải là số nguyên từ 1 trở lên.').optional(),
  itemIds: z.array(objectId('Mã hàng cá thể'), { error: 'Danh sách mã hàng cá thể không hợp lệ.' }).max(500).optional().default([]),
  targetLocationId: objectId('Nơi nhập lại').nullish(),
  targetStorageId: objectId('Kệ nhập lại').nullish(),
  responsibleParty: z.enum(responsibleParties, { error: 'Bên chịu trách nhiệm không hợp lệ.' }).nullish(),
  note: z.string({ error: 'Ghi chú không hợp lệ.' }).trim().max(1000, 'Ghi chú tối đa 1000 ký tự.').optional().default(''),
}).superRefine((value, ctx) => {
  if (new Set(value.itemIds).size !== value.itemIds.length) ctx.addIssue({ code: 'custom', message: 'Danh sách mã hàng cá thể bị trùng.' });
  if (value.outcome === 'found' && !value.targetLocationId) ctx.addIssue({ code: 'custom', message: 'Chọn nơi nhập lại hàng tìm thấy.' });
  if (value.outcome === 'lost') {
    if (!value.responsibleParty) ctx.addIssue({ code: 'custom', message: 'Chọn bên chịu trách nhiệm cho hàng mất.' });
    if (!value.note) ctx.addIssue({ code: 'custom', message: 'Nhập ghi chú cho kết luận mất hàng.' });
  }
});

export const validateResolveDiscrepancy = (payload) => {
  const parsed = resolveSchema.safeParse(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {});
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Dữ liệu kết luận không hợp lệ.');
  const data = parsed.data;
  return {
    ...data,
    targetLocationId: data.outcome === 'found' ? data.targetLocationId : null,
    targetStorageId: data.outcome === 'found' ? data.targetStorageId || null : null,
    responsibleParty: data.outcome === 'lost' ? data.responsibleParty : null,
  };
};
