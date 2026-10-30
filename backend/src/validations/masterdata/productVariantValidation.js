import { validateInput } from '../../generic/inputValidation.js';

const fields = ['productId', 'sku', 'variantName', 'size', 'color', 'attributes', 'salePrice', 'rentalPricePerDay', 'depositAmount', 'status'];
const rules = {
  productId: { label: 'Sản phẩm', type: 'objectId', required: true },
  sku: { label: 'SKU', type: 'string', required: true, maxLength: 100 },
  variantName: { label: 'Tên biến thể', type: 'string', maxLength: 160 },
  size: { label: 'Kích thước', type: 'string', maxLength: 80 },
  color: { label: 'Màu sắc', type: 'string', maxLength: 80 },
  attributes: { label: 'Thuộc tính', type: 'object' },
  salePrice: { label: 'Giá bán', type: 'number', min: 0 },
  rentalPricePerDay: { label: 'Giá thuê mỗi ngày', type: 'number', min: 0 },
  depositAmount: { label: 'Tiền cọc', type: 'number', min: 0 },
  status: { label: 'Trạng thái', type: 'string', enum: ['active', 'inactive'] },
};
export const validateProductVariant = (payload, current) => validateInput(payload, current, fields, rules);
