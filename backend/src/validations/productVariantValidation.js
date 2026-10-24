import mongoose from 'mongoose';

const allowedFields = new Set(['size', 'color', 'condition', 'quantity', 'status']);

//duc 2026-10-15: Trả lỗi dữ liệu variant theo cùng định dạng validation của product.
const validationError = (message) => Object.assign(new Error(message), { statusCode: 400 });

//duc 2026-10-15: Xác nhận ID product và variant trước khi service truy vấn dữ liệu.
export const validateVariantObjectIds = (productId, variantId) => {
  if (!mongoose.isValidObjectId(productId)) throw validationError('productId không hợp lệ');
  if (variantId && !mongoose.isValidObjectId(variantId)) throw validationError('variantId không hợp lệ');
};

//duc 2026-10-15: Kiểm tra các trường variant, dùng partial cho cả payload cập nhật.
export const validateProductVariantFields = (body, { partial = false } = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw validationError('Body phải là một object');
  const unknownFields = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unknownFields.length) throw validationError(`Trường không được hỗ trợ: ${unknownFields.join(', ')}`);

  const input = {};
  for (const field of ['size', 'quantity']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'number' || !Number.isInteger(body[field])) {
        throw validationError(`${field} phải là số nguyên`);
      }
      if (field === 'quantity' && body[field] < 0) throw validationError('quantity không được âm');
      input[field] = body[field];
    }
  }
  for (const field of ['color', 'condition']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || !body[field].trim()) throw validationError(`${field} phải là chuỗi không rỗng`);
      input[field] = body[field].trim();
    }
  }
  if (body.status !== undefined) {
    if (!['active', 'inactive', 'maintenance'].includes(body.status)) {
      throw validationError('status phải là active, inactive hoặc maintenance');
    }
    input.status = body.status;
  }

  if (!partial) {
    for (const field of ['size', 'color', 'condition', 'quantity']) {
      if (input[field] === undefined) throw validationError(`${field} là bắt buộc`);
    }
  }
  return input;
};
