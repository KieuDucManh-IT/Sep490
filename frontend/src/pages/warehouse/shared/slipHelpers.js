/** Hàm nhỏ dùng chung cho các trang phiếu kho. */

/** Lấy id dạng chuỗi từ object đã populate hoặc id thô. */
export const idOf = (value) => String(value?._id || value || '');

/** Ngày giờ theo định dạng Việt Nam; rỗng → '—'. */
export const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
};

/** "Mã · tên" của kho / chi nhánh / kệ. */
export const codeAndName = (place) => [place?.code, place?.name].filter(Boolean).join(' · ') || '—';

/** Lỗi 409 = phiếu vừa đổi trạng thái ở nơi khác (hoặc tồn vừa thay đổi) → trang cần tải lại. */
export const isConflict = (error) => error?.status === 409;
