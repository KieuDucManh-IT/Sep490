import { validateInput } from '../../generic/inputValidation.js';

const fields = ['productId', 'sku', 'size', 'color', 'attributes', 'status', 'isDeleted'];
const rules = {
  productId: { label: 'Sản phẩm', type: 'objectId', required: true },
  sku: { label: 'SKU', type: 'string', maxLength: 100 },
  size: { label: 'Kích thước', type: 'string', maxLength: 80 },
  color: { label: 'Màu sắc', type: 'string', maxLength: 80 },
  attributes: { label: 'Thuộc tính', type: 'object' },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive'] },
  isDeleted: { label: 'Đã xóa', type: 'boolean' },
};
export const validateProductVariant = (payload, current) => validateInput(payload, current, fields, rules);
