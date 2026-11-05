import { validateInput } from '../../generic/inputValidation.js';

const fields = ['parentCategoryId', 'type', 'name', 'description', 'status', 'isDeleted'];
const rules = {
  parentCategoryId: { label: 'Loại cha', type: 'objectId', nullable: true },
  type: { label: 'Cấp danh mục', type: 'string', required: true, enum: ['lv1', 'lv2', 'lv3'] },
  name: { label: 'Tên loại', type: 'string', required: true, maxLength: 120 },
  description: { label: 'Mô tả', type: 'string', maxLength: 1000 },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive'] },
  isDeleted: { label: 'Đã xóa', type: 'boolean' },
};
export const validateCategory = (payload, current) => validateInput(payload, current, fields, rules);
