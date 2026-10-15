import mongoose from 'mongoose';

const allowedFields = new Set([
  'sku', 'name', 'images', 'brand', 'material', 'category', 'tag',
  'rentalPricePerDay', 'deposit', 'salePrice', 'discount'
]);

//duc 2026-10-15: Tạo lỗi validation có HTTP status để controller phản hồi 400 hoặc 404.
const validationError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

//duc 2026-10-15: Xác nhận ID hợp lệ trước khi truy vấn MongoDB.
export const validateObjectId = (value, fieldName = 'id') => {
  if (!mongoose.isValidObjectId(value)) throw validationError(`${fieldName} không hợp lệ`);
};

//duc 2026-10-15: Chuẩn hóa và kiểm tra kiểu dữ liệu sản phẩm từ request.
//duc 2026-10-15: Chuẩn hóa và kiểm tra các trường sản phẩm; partial cho phép dùng chung khi cập nhật.
export const validateProductFields = (body, { partial = false } = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw validationError('Body phải là một object');
  const unknownFields = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unknownFields.length) throw validationError(`Trường không được hỗ trợ: ${unknownFields.join(', ')}`);

  const input = {};
  for (const field of ['sku', 'name', 'brand', 'material']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string' || !body[field].trim()) throw validationError(`${field} phải là chuỗi không rỗng`);
      input[field] = body[field].trim();
    }
  }
  for (const field of ['rentalPricePerDay', 'deposit', 'salePrice', 'discount']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'number' || !Number.isFinite(body[field]) || body[field] < 0) {
        throw validationError(`${field} phải là số không âm`);
      }
      input[field] = body[field];
    }
  }
  if (input.discount !== undefined && input.discount > 100) throw validationError('discount phải nằm trong khoảng 0 đến 100');
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.some((image) => typeof image !== 'string' || !image.trim())) {
      throw validationError('images phải là mảng các chuỗi không rỗng');
    }
    input.images = body.images.map((image) => image.trim());
  }
  if (body.category !== undefined) {
    if (!Array.isArray(body.category) || body.category.some((item) => typeof item !== 'string' || !item.trim())) {
      throw validationError('category phải là mảng các chuỗi không rỗng');
    }
    input.category = body.category.map((item) => item.trim());
  }
  if (body.tag !== undefined) {
    if (!['sale', 'rental', 'both'].includes(body.tag)) throw validationError('tag phải là sale, rental hoặc both');
    input.tag = body.tag;
  }

  if (!partial) {
    for (const field of ['sku', 'name']) {
      if (!input[field]) throw validationError(`${field} là bắt buộc`);
    }
    const tag = input.tag || 'sale';
    if ((tag === 'sale' || tag === 'both') && input.salePrice === undefined) throw validationError('salePrice là bắt buộc với sản phẩm bán');
    if ((tag === 'rental' || tag === 'both') && input.rentalPricePerDay === undefined) throw validationError('rentalPricePerDay là bắt buộc với sản phẩm cho thuê');
  }
  return input;
};

//duc 2026-10-15: Kiểm tra dữ liệu tạo sản phẩm trước khi chạy nghiệp vụ.
export const validateCreateProduct = (body) => validateProductFields(body);

//duc 2026-10-15: Dùng chung bộ kiểm tra trường sản phẩm cho payload cập nhật dạng partial.
export const validateUpdateProduct = (body) => validateProductFields(body, { partial: true });

//duc 2026-10-15: Giới hạn bộ lọc danh sách và kích thước trang để truy vấn có kiểm soát.
export const validateProductListQuery = (query) => {
  const { search, tag, status, page = '1', limit = '20' } = query;
  if (tag && !['sale', 'rental', 'both'].includes(tag)) throw validationError('tag không hợp lệ');
  if (status && !['pending', 'active', 'inactive', 'rejected'].includes(status)) throw validationError('status không hợp lệ');
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw validationError('page phải là số nguyên dương');
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) throw validationError('limit phải nằm trong khoảng 1 đến 100');
  return { search: typeof search === 'string' ? search.trim() : '', tag, status, page: pageNumber, limit: limitNumber };
};
