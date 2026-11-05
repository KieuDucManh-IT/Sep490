import { validateInput } from '../../generic/inputValidation.js';

const fields = ['supplierCode', 'name', 'contactName', 'phone', 'email', 'taxCode', 'address', 'status'];
const rules = {
  supplierCode: { label: 'Mã nhà cung cấp', type: 'string', required: true, maxLength: 60 },
  name: { label: 'Tên nhà cung cấp', type: 'string', required: true, maxLength: 200 },
  contactName: { label: 'Người liên hệ', type: 'string', maxLength: 160 },
  phone: { label: 'Số điện thoại', type: 'string', maxLength: 30 },
  email: { label: 'Email', type: 'string', email: true, maxLength: 254 },
  taxCode: { label: 'Mã số thuế', type: 'string', maxLength: 50 },
  address: { label: 'Địa chỉ', type: 'string', maxLength: 500 },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive'] },
};
export const validateSupplier = (payload, current) => validateInput(payload, current, fields, rules);
