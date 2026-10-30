import { validateInput } from '../../generic/inputValidation.js';

const fields = ['parentCategoryId', 'name', 'description', 'status'];
const rules = {
  parentCategoryId: { label: 'Loại cha', type: 'objectId', nullable: true },
  name: { label: 'Tên loại', type: 'string', required: true, maxLength: 120 },
  description: { label: 'Mô tả', type: 'string', maxLength: 1000 },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive'] },
};
export const validateCategory = (payload, current) => validateInput(payload, current, fields, rules);
