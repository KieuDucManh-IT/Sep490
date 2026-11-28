import { z } from 'zod';

const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const objectId = (message) => z.string({ error: message }).regex(/^[a-f\d]{24}$/i, { error: message });
const text = (max, message) => z.string({ error: message }).trim().max(max, { error: `${message} tối đa ${max} ký tự.` });
// '' hoặc null => không nhập; còn lại ép về số >= 0.
const money = (message) => z.preprocess((value) => (value === '' || value === null ? undefined : value), z.coerce.number({ error: message }).finite({ error: message }).min(0, { error: message }).optional());

export const MAINTENANCE_TYPES = ['cleaning', 'repair', 'inspection', 'replacement_part', 'other'];
export const DISPOSAL_METHODS = ['discard', 'sell_as_is', 'recycle', 'donate', 'other'];
export const MAINTENANCE_RESULTS = ['success', 'failed', 'unrepairable'];

const parse = (schema, payload) => {
  const result = schema.safeParse(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {});
  if (!result.success) throw invalid(result.error.issues[0]?.message || 'Dữ liệu không hợp lệ.');
  return result.data;
};

const createMaintenanceSchema = z.object({
  itemId: objectId('Chọn món hàng cần giặt/sửa.'),
  maintenanceType: z.enum(MAINTENANCE_TYPES, { error: 'Loại xử lý không hợp lệ.' }),
  issueDescription: text(1000, 'Mô tả vấn đề').min(1, { error: 'Nhập mô tả vấn đề của món hàng.' }),
  assignedTo: objectId('Chọn nhân viên kho phụ trách.'),
  note: text(1000, 'Ghi chú').optional().default(''),
});

const completeMaintenanceSchema = z.object({
  repairResult: z.enum(MAINTENANCE_RESULTS, { error: 'Chọn kết quả xử lý.' }),
  targetStorageId: objectId('Kệ xếp lại không hợp lệ.').optional().nullable(),
  disposalMethod: z.enum(DISPOSAL_METHODS, { error: 'Cách thanh lý đề xuất không hợp lệ.' }).optional().nullable(),
  repairDescription: text(1000, 'Mô tả công việc').optional().default(''),
  cost: money('Chi phí phải là số không âm.'),
}).superRefine((value, ctx) => {
  if (value.repairResult === 'success') {
    if (!value.targetStorageId) ctx.addIssue({ code: 'custom', message: 'Chọn kệ để xếp lại món hàng.' });
  }
  if (value.repairResult === 'unrepairable') {
    if (!value.disposalMethod) ctx.addIssue({ code: 'custom', message: 'Chọn cách thanh lý đề xuất.' });
    if (!value.repairDescription) ctx.addIssue({ code: 'custom', message: 'Nhập mô tả lý do không thể sửa.' });
  }
});

const cancelMaintenanceSchema = z.object({
  reason: text(1000, 'Lý do hủy').optional().default(''),
});

const createDisposalSchema = z.object({
  itemId: objectId('Chọn món hàng cần thanh lý.'),
  reason: text(1000, 'Lý do thanh lý').min(1, { error: 'Nhập lý do thanh lý.' }),
  method: z.enum(DISPOSAL_METHODS, { error: 'Cách thanh lý không hợp lệ.' }),
  estimatedValue: money('Giá trị ước tính phải là số không âm.'),
});

const decideDisposalSchema = z.object({
  decision: z.enum(['approve', 'reject'], { error: 'Quyết định phải là duyệt hoặc từ chối.' }),
  method: z.enum(DISPOSAL_METHODS, { error: 'Cách thanh lý không hợp lệ.' }).optional().nullable(),
  actualValue: money('Giá trị thu hồi phải là số không âm.'),
  decisionNote: text(1000, 'Ghi chú').optional().default(''),
});

export const validateCreateMaintenance = (payload) => parse(createMaintenanceSchema, payload);
export const validateCompleteMaintenance = (payload) => {
  const data = parse(completeMaintenanceSchema, payload);
  return {
    repairResult: data.repairResult,
    targetStorageId: data.repairResult === 'success' ? data.targetStorageId : null,
    disposalMethod: data.repairResult === 'unrepairable' ? data.disposalMethod : null,
    repairDescription: data.repairDescription,
    cost: data.cost ?? 0,
  };
};
export const validateCancelMaintenance = (payload) => parse(cancelMaintenanceSchema, payload);
export const validateCreateDisposal = (payload) => parse(createDisposalSchema, payload);
export const validateDecideDisposal = (payload) => parse(decideDisposalSchema, payload);
