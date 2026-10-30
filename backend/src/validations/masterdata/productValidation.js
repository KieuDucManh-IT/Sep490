import { validateInput } from '../../generic/inputValidation.js';

const fields = ['categoryId', 'productCode', 'name', 'description', 'productType', 'trackingType', 'status', 'isDeleted'];
const rules = {
  categoryId: { label: 'Loại sản phẩm', type: 'objectId', required: true },
  productCode: { label: 'Mã sản phẩm', type: 'string', required: true, maxLength: 80 },
  name: { label: 'Tên sản phẩm', type: 'string', required: true, maxLength: 200 },
  description: { label: 'Mô tả', type: 'string', maxLength: 2000 },
  productType: { label: 'Hình thức sản phẩm', type: 'string', required: true, enum: ['sale', 'rental', 'both'] },
  trackingType: { label: 'Kiểu theo dõi', type: 'string', required: true, enum: ['quantity', 'individual'] },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive', 'discontinued'] },
  isDeleted: { label: 'Trạng thái xóa', type: 'boolean' },
};
export const validateProduct = (payload, current) => validateInput(payload, current, fields, rules);
