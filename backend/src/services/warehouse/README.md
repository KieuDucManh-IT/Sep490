# Phân hệ kho — backend (`services/warehouse`)

Tài liệu ngắn để đọc code và bảo vệ đồ án: luồng phiếu, file nào làm gì, quy tắc tồn kho.

## 1. Các luồng phiếu

```
Nhập kho (NCC → kho tổng)          awaiting_receiving → received → approved → completed
  inboundReceiptService              (received → awaiting_receiving khi WM yêu cầu kiểm nhận lại; chưa completed → cancelled;
                                      `rejected` chỉ còn ở dữ liệu cũ)
                                     Tồn cộng ở bước completed (xếp hàng lên kệ).

Điều chuyển (kho tổng → chi nhánh)  requested → approved → preparing → shipped → partially_received → received
  stockTransferService               (requested → rejected; requested/approved/preparing → cancelled)
                                     Trừ kho tổng lúc shipped, cộng chi nhánh lúc nhận. Nhận thiếu → phiếu chênh lệch.

Trả hàng (chi nhánh → kho tổng)    requested → approved → shipped → receipt_submitted → receipt_approved → completed
  branchReturnService                (approved: giữ tồn chi nhánh; shipped: trừ chi nhánh; completed: cộng kệ kho tổng)

Chênh lệch điều chuyển             open → partially_resolved → resolved
  stockDiscrepancyService            "tìm thấy" → nhập lại (chi nhánh nhận hoặc kệ kho tổng); "mất" → món disposed

Tách / gộp kệ                      assigned → in_progress → completed   (assigned → cancelled)
  stockRelocationService             Lúc tạo: giữ hàng ở kệ nguồn. Lúc hoàn tất: kệ nguồn −, kệ đích +.

Kiểm kê                            draft → in_progress → counted → approved   (→ cancelled trước approved)
Điều chỉnh tồn                     requested → approved | rejected; approved → applied
  stockControlDomainCore             Duyệt kiểm kê sinh phiếu điều chỉnh; tồn chỉ đổi ở bước applied.

Giặt / sửa                         pending → in_progress → completed   (→ cancelled)
Thanh lý                           requested → completed | rejected
  ../maintenance/maintenanceService  Món bị khóa ở trạng thái maintenance trong lúc xử lý.
```

## 2. File nào làm gì

| File | Việc |
|---|---|
| `shared/errors.js` | `appError(message, statusCode, code)` — lỗi nghiệp vụ có mã HTTP. |
| `shared/roles.js` | `normalizeRole` (bỏ khoảng trắng, `_`, `-`; `brandmanager` → `branchmanager`), `isWarehouseManager`, `isWarehouseStaff`, `isBranchManager`, `isAdmin`, `requireRole`. |
| `shared/locations.js` | `getCentralWarehouse(session)` — đúng một kho tổng đang hoạt động, nếu không thì 409. |
| `shared/capacity.js` | Sức chứa: `assertBranchCapacity` (chi nhánh), `capacitySnapshot` (kho tổng, gồm phần đã cam kết cho phiếu đang mở), `addToStorageChain`. |
| `shared/pagination.js` | `parsePaging`, `pagedResult`, `searchRegex` — hàm thuần, có unit test. |
| `shared/listing.js` | `listSlips`: danh sách phiếu có phân trang, tìm kiếm, gom chi tiết bằng một truy vấn `$in` (không N+1). |
| `inventoryLedgerService.js` | Ghi balance hàng `quantity` bằng lệnh có điều kiện (`increase`/`decrease`/`reserve`/`releaseReserved`) và ghi sổ `StockMovement`. |
| `itemStateService.js` | Cách DUY NHẤT để đổi trạng thái / vị trí / kệ của món `individual`; cập nhật balance trong cùng transaction. |
| `itemBalanceRules.js` | Hàm thuần: quy đổi trạng thái món → phần chênh balance, kiểm invariant. |
| `balanceQueryService.js` | Đọc số lượng: `availableOf`, `getBalances`, `getAvailable`, `stockMismatchError`. |
| `pickSuggestionRules.js` | Hàm thuần: gợi ý kệ / món lấy hàng cho phiếu xuất (ít kệ nhất, sắp theo mã vị trí), có unit test. API `GET /transfers/:id/pick-suggestion` chỉ đọc. |
| `orderStockService.js` | Giữ / nhả tồn cho đơn thuê / bán. |
| `inboundReceiptService.js`, `stockTransferService.js`, `branchReturnService.js`, `stockDiscrepancyService.js`, `stockRelocationService.js`, `stockControlDomainCore.js` | Nghiệp vụ từng loại phiếu (xem mục 1). `stocktakeService.js` / `stockAdjustmentService.js` chỉ re-export từ `stockControlDomainCore.js`. |
| `inventoryReportService.js`, `inventoryReportRules.js`, `branchInventoryReportService.js` | Báo cáo tồn kho tổng / chi nhánh (đọc từ balance). |
| `inventoryReconcileService.js` | Đối soát balance của hàng `individual` với các món. |

## 3. Quy tắc tồn kho

1. **`InventoryBalance` là số tổng** cho mọi loại hàng, theo khóa (`locationId`, `storageId`, `variantId`).
   Khả dụng = `quantityOnHand − quantityReserved − quantityUnavailable` (chỉ tính ở `balanceQueryService.availableOf`).
2. **Hàng `individual`: món (`InventoryItem`) là nguồn gốc.** Balance của hàng này luôn khớp với số món;
   mọi thay đổi trạng thái món đi qua `itemStateService` (không `updateOne` món trực tiếp ở service khác).
3. **Hàng `quantity`: chỉ ghi balance qua `inventoryLedgerService`**, bằng một lệnh `findOneAndUpdate` có điều kiện
   (không đọc → sửa → `save()`), sau đó kiểm invariant `onHand ≥ reserved + unavailable`, sai → 409 và rollback.
4. Mọi thay đổi tồn nằm trong `session.withTransaction`, kèm một dòng `StockMovement` (trừ giữ / nhả chỗ).
5. Sức chứa chỉ đọc `quantityOnHand` từ balance, cộng dồn từ kệ lên Dãy, Khu và toàn kho.

## 4. Trạng thái món → balance

| Trạng thái món | onHand | unavailable | reserved | renting | Ghi chú |
|---|:-:|:-:|:-:|:-:|---|
| `available` | +1 | | | | Khả dụng |
| `reserved` | +1 | | +1 nếu phiếu kho giữ (`warehouseHold`) | | Giữ của đơn hàng nằm ở `InventoryReservation` |
| `unavailable` | +1 | +1 | | | Hỏng, chờ xử lý |
| `maintenance` | +1 | +1 | | | Đang giặt / sửa hoặc chờ thanh lý |
| `renting` | | | | +1 (dòng `storageId: null`) | Đang cho thuê |
| `in_transit` | | | | | Đang vận chuyển, không thuộc kho nào |
| `disposed`, `sold` | | | | | Đã ra khỏi sổ |

## 5. API danh sách có phân trang

Các API `GET` danh sách phiếu (điều chuyển, nhập kho, trả hàng, tách/gộp, chênh lệch, kiểm kê, điều chỉnh) nhận
`page`, `limit` (mặc định 20, tối đa 100), `status`, `search`. Có `page` hoặc `limit` → `{ items, total, page, limit }`,
mỗi phiếu kèm `lineCount`, `totalQuantity`; không có → mảng như cũ (tương thích frontend cũ).
`GET /api/warehouse/discrepancies/count?status=open` → `{ count }`.
