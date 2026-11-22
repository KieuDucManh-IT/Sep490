/**
 * Bảng nhãn tiếng Việt dùng chung cho phân hệ kho.
 *
 * Mọi trang kho lấy nhãn từ đây thay vì tự khai báo lại, để cùng một trạng thái
 * luôn hiển thị cùng một chữ. Giá trị được lấy nguyên từ các trang hiện có
 * (không đổi nghĩa); chỗ nào hai trang dùng hai cách gọi khác nhau thì giữ cả hai
 * bảng và ghi chú rõ bảng nào dùng ở đâu.
 */

/** Nhãn mặc định khi gặp giá trị không có trong bảng. */
export const UNKNOWN_LABEL = 'Không xác định';

/**
 * Lấy nhãn của một giá trị trong bảng nhãn.
 * @param {Record<string, string>} map bảng nhãn
 * @param {string} key giá trị cần dịch (ví dụ 'approved')
 * @param {string} [fallback] chữ hiển thị khi không có trong bảng
 */
export function labelOf(map, key, fallback = UNKNOWN_LABEL) {
  if (map && Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  return fallback;
}

/**
 * Tên hiển thị của một biến thể: "Tên · SKU · size · màu".
 * Nhận biến thể đã populate `productId` (có `name`), hoặc truyền tên sản phẩm riêng.
 * @param {object} variant biến thể sản phẩm
 * @param {string} [productName] tên sản phẩm khi `variant.productId` chưa populate
 */
export function formatVariantName(variant, productName) {
  if (!variant) return '';
  const name = productName || variant.productId?.name;
  return [name, variant.sku, variant.size, variant.color].filter(Boolean).join(' · ');
}

/* ---------------- Phiếu kho ---------------- */

/** Phiếu nhập kho — nhãn ngắn dùng trong danh sách (InboundReceiptsPage). */
export const INBOUND_STATUS_LABELS = {
  awaiting_receiving: 'Chờ tiếp nhận',
  received: 'Chờ duyệt',
  approved: 'Chờ sắp xếp',
  completed: 'Hoàn tất',
  rejected: 'Đã từ chối (cũ)',
  cancelled: 'Đã hủy',
};

/** Phiếu nhập kho — nhãn đầy đủ dùng trong chi tiết phiếu (InboundReceiptModal). */
export const INBOUND_STATUS_DETAIL_LABELS = {
  awaiting_receiving: 'Chờ nhân viên tiếp nhận',
  received: 'Chờ chủ kho duyệt',
  approved: 'Chờ sắp xếp vào kệ',
  completed: 'Hoàn tất',
  rejected: 'Đã từ chối (cũ)',
  cancelled: 'Đã hủy',
};

/** Phiếu xuất kho tổng → chi nhánh (WarehouseTransfersPage). */
export const TRANSFER_STATUS_LABELS = {
  requested: 'Chờ kho tổng duyệt',
  approved: 'Đã duyệt, chờ nhân viên soạn',
  rejected: 'Bị từ chối',
  preparing: 'Đang soạn hàng',
  shipped: 'Đang điều chuyển',
  partially_received: 'Đã nhận một phần',
  received: 'Đã nhận hàng',
  cancelled: 'Đã hủy',
};

/** Phiếu trả hàng chi nhánh → kho tổng (BranchReturnsPage). Cùng mã trạng thái nhưng nghĩa khác chiều xuất. */
export const BRANCH_RETURN_STATUS_LABELS = {
  requested: 'Chờ kho tổng duyệt',
  approved: 'Đã duyệt, chờ chi nhánh gửi',
  rejected: 'Bị từ chối',
  shipped: 'Đang chuyển về kho tổng',
  receipt_submitted: 'Chờ duyệt kết quả nhận',
  receipt_approved: 'Đã duyệt nhận, chờ xếp kệ',
  completed: 'Hoàn tất',
};

/** Chiều điều chuyển. */
export const TRANSFER_DIRECTION_LABELS = {
  central_to_branch: 'Kho tổng → Chi nhánh',
  branch_to_central: 'Chi nhánh → Kho tổng',
};

/**
 * Phiếu kiểm kê (WarehouseStocktakePage). Bảng này có cả trạng thái của phiếu
 * điều chỉnh sinh ra từ kiểm kê (requested/rejected/applied) vì trang kiểm kê hiển thị chung.
 */
export const STOCKTAKE_STATUS_LABELS = {
  draft: 'Nháp',
  in_progress: 'Đang kiểm',
  counted: 'Chờ duyệt kiểm kê',
  approved: 'Đã duyệt',
  cancelled: 'Đã hủy',
  requested: 'Chờ duyệt điều chỉnh',
  rejected: 'Từ chối',
  applied: 'Đã cập nhật tồn',
};

/** Phiếu điều chỉnh tồn (WarehouseAdjustmentPage). */
export const ADJUSTMENT_STATUS_LABELS = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  applied: 'Đã cập nhật tồn',
  cancelled: 'Đã hủy',
};

/** Loại phiếu tách / gộp tồn. */
export const RELOCATION_TYPE_LABELS = {
  move: 'Di chuyển hàng',
  split: 'Tách (cũ)',
  merge: 'Gộp (cũ)',
};

/** Phiếu tách / gộp tồn. Trang hiện hiển thị mã thô, bảng này mới thêm theo enum của model. */
export const RELOCATION_STATUS_LABELS = {
  assigned: 'Đã giao việc',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

/* ---------------- Chênh lệch điều chuyển ---------------- */

/** Phiếu chênh lệch (StockDiscrepancyDetail). */
export const DISCREPANCY_STATUS_LABELS = {
  open: 'Đang điều tra',
  partially_resolved: 'Đã xử lý một phần',
  resolved: 'Đã xử lý',
};

/** Màu badge cho phiếu chênh lệch: ánh xạ sang class `status-*` có sẵn của `wm-status-badge`. */
export const DISCREPANCY_STATUS_CLASS = {
  open: 'status-cancelled',
  partially_resolved: 'status-in_progress',
  resolved: 'status-completed',
};

/** Kết quả điều tra một món chênh lệch. */
export const DISCREPANCY_OUTCOME_LABELS = {
  found: 'Tìm thấy',
  lost: 'Mất',
};

/** Bên chịu trách nhiệm khi kết luận chênh lệch. */
export const RESPONSIBLE_PARTY_LABELS = {
  central_warehouse: 'Kho tổng',
  branch: 'Chi nhánh',
  carrier: 'Đơn vị vận chuyển',
  unknown: 'Chưa xác định',
};

/* ---------------- Món hàng ---------------- */

/** Tình trạng (condition) của món hàng. */
export const CONDITION_LABELS = {
  new: 'Mới',
  good: 'Tốt',
  worn: 'Đã qua sử dụng',
  damaged: 'Hỏng',
  unrepairable: 'Không thể sửa',
  missing: 'Thất lạc',
};

/** Tình trạng món trong màn chênh lệch: `missing` được gọi là "Thiếu / không tìm thấy". */
export const DISCREPANCY_CONDITION_LABELS = {
  ...CONDITION_LABELS,
  missing: 'Thiếu / không tìm thấy',
};

/** Trạng thái món hàng (InventoryItem.status), gồm cả `sold`. */
export const ITEM_STATUS_LABELS = {
  available: 'Sẵn sàng',
  unavailable: 'Không khả dụng',
  maintenance: 'Đang xử lý',
  reserved: 'Đang giữ chỗ',
  renting: 'Đang cho thuê',
  in_transit: 'Đang điều chuyển',
  disposed: 'Đã thanh lý',
  sold: 'Đã bán',
};

/** Kết quả nhận của một món (màn nhận hàng: mặc định "Nhận tốt", chỉ đánh dấu món hỏng / thiếu). */
export const RECEIPT_STATE_LABELS = {
  good: 'Nhận tốt',
  damaged: 'Hỏng',
  missing: 'Thiếu',
};

/* ---------------- Trả hàng bán ---------------- */

/** Cách xử lý món khách trả (SalesReturnDetail.disposition). */
export const SALES_RETURN_DISPOSITION_LABELS = {
  restock: 'Nhập lại kho',
  quarantine: 'Cách ly',
  repair: 'Sửa chữa',
  dispose: 'Hủy bỏ',
};

/** Tình trạng món khi khách trả (SalesReturnDetail.conditionOnReturn). */
export const SALES_RETURN_CONDITION_LABELS = {
  new: 'Mới',
  good: 'Tốt',
  worn: 'Đã qua sử dụng',
  damaged: 'Hỏng',
  unrepairable: 'Không thể sửa',
};

/* ---------------- Giặt / sửa / thanh lý ---------------- */

/** Loại phiếu giặt / sửa. */
export const MAINTENANCE_TYPE_LABELS = {
  cleaning: 'Giặt/vệ sinh',
  repair: 'Sửa chữa',
  inspection: 'Kiểm tra',
  replacement_part: 'Thay phụ kiện',
  other: 'Khác',
};

/** Trạng thái phiếu giặt / sửa. */
export const MAINTENANCE_STATUS_LABELS = {
  pending: 'Chờ làm',
  in_progress: 'Đang làm',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

/** Kết quả giặt / sửa. */
export const MAINTENANCE_RESULT_LABELS = {
  success: 'Đạt',
  failed: 'Không đạt',
  unrepairable: 'Không thể sửa',
};

/** Cách thanh lý. */
export const DISPOSAL_METHOD_LABELS = {
  discard: 'Hủy bỏ',
  sell_as_is: 'Bán thanh lý nguyên trạng',
  recycle: 'Tái chế',
  donate: 'Quyên góp',
  other: 'Khác',
};

/** Trạng thái đề xuất thanh lý. */
export const DISPOSAL_STATUS_LABELS = {
  requested: 'Chờ duyệt',
  approved: 'Đã duyệt',
  completed: 'Đã thanh lý',
  rejected: 'Đã từ chối',
};

/* ---------------- Vị trí lưu trữ ---------------- */

/** Loại vị trí lưu trữ. Thay cho Zone / Row / Shelf hiển thị thô. */
export const STORAGE_TYPE_LABELS = {
  zone: 'Khu',
  row: 'Dãy',
  shelf: 'Kệ',
  temporary_area: 'Khu tạm',
};

/* ---------------- Sổ biến động (lịch sử mã hàng) ---------------- */

/** Loại dòng sổ biến động; `move` = cặp xuất / nhập cùng phiếu được ghép thành một dòng "từ → đến". */
export const MOVEMENT_TYPE_LABELS = {
  inbound: 'Nhập kho',
  outbound: 'Xuất kho',
  transfer_out: 'Chuyển đi',
  transfer_in: 'Chuyển đến',
  move: 'Di chuyển',
  sale: 'Bán',
  rental_out: 'Cho thuê',
  rental_return: 'Khách trả hàng thuê',
  sales_return: 'Khách trả hàng mua',
  adjustment: 'Điều chỉnh tồn',
  disposal: 'Thanh lý',
};
