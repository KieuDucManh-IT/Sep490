// Tạo lỗi nghiệp vụ có mã HTTP để controller trả về cho người dùng.
// Dùng chung cho mọi service kho thay cho các hàm `fail` chép ở từng file.

/**
 * Tạo Error mang `statusCode` (và `code` nếu có) để controller biết trả 400/403/404/409.
 * Message giữ nguyên câu tiếng Việt hiển thị cho người dùng.
 */
export const appError = (message, statusCode = 400, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code !== undefined) error.code = code;
  return error;
};
