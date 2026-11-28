import { formatVariantName } from '../../../constants/warehouseLabels';

/** Lấy id dạng chuỗi từ object đã populate hoặc id thô. */
export const idOf = (value) => String(value?._id || value || '');

/** "Mã · Tên" của kho / chi nhánh. */
export const locationName = (location) => `${location?.code || ''} · ${location?.name || ''}`;

/** "Tên sản phẩm · SKU · size · màu" của một dòng phiếu. */
export const lineName = (line) => formatVariantName(line?.variantId);

/** Mã hiển thị của một món hàng. */
export const itemCodeOf = (item) => item?.itemCode || item?.serialNumber || idOf(item).slice(-6);
