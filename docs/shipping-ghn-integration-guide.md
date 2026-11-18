# Hướng Dẫn Vận Hành & Tích Hợp Vận Chuyển GHN (Giao Hàng Nhanh)

Tài liệu này hướng dẫn cách cấu hình, vận hành và kiểm thử tính năng tích hợp dịch vụ vận chuyển Giao Hàng Nhanh (GHN) API v2 trên nền tảng thời trang cao cấp **VESTORA**.

---

## 1. Cấu Hình Môi Trường (Environment Configuration)

Hệ thống kết nối trực tiếp 100% với hệ sinh thái GHN API v2 thông qua các biến môi trường trong file `.env` tại thư mục `backend/`:

```env
# 1. Chế độ GHN Sandbox (Kiểm thử thực tế trên cổng Test của GHN)
GHN_API_URL=https://dev-online-gateway.ghn.vn
GHN_API_TOKEN=your_sandbox_token_here
GHN_SHOP_ID=your_sandbox_shop_id_here

# 2. Chế độ Production (Vận hành thực tế trên cổng chính thức)
# GHN_API_URL=https://online-gateway.ghn.vn
# GHN_API_TOKEN=your_production_token_here
# GHN_SHOP_ID=your_production_shop_id_here
```

### So sánh các môi trường:
| Tiêu chí | GHN Sandbox (Staging/Dev) | Production (Vận hành thật) |
|---|---|---|
| **Cước phí** | **0đ (Môi trường giả lập)** | **Thu phí theo cước thực tế của GHN** |
| **Mạng Internet** | Cần kết nối Internet | Cần kết nối Internet |
| **Shipper ngoài đời** | Không có bưu tá thật đến lấy | **Có bưu tá thật đến Showroom lấy đồ** |
| **Mã vận đơn** | Mã GHN hợp lệ trên dev portal (VD: `LY7D7U`) | Mã GHN thật trên cổng vận hành |
| **Mục đích** | Phát triển, kiểm thử, demo đồ án | Cửa hàng mở bán thực tế |

---

## 2. Cấu Hình Webhook Real-time trên GHN Portal

Để nhận cập nhật trạng thái tự động ngay khi shipper lấy hàng, đang giao hoặc giao hàng thành công:

1. Đăng nhập vào trang quản trị GHN (Sandbox: [dev-online-gateway.ghn.vn](https://dev-online-gateway.ghn.vn) hoặc Prod: [online-gateway.ghn.vn](https://online-gateway.ghn.vn)).
2. Truy cập mục **Quản lý tài khoản ➔ Cấu hình API / Webhook**.
3. Điền Callback URL chính xác của server:
   ```
   https://your-domain.com/api/shipping/webhook/ghn
   ```
4. Chọn các sự kiện: `ready_to_pick`, `picking`, `picked`, `storing`, `transporting`, `delivering`, `delivered`, `delivery_fail`, `return`, `cancel`.
5. Bấm **Lưu cấu hình**.

---

## 3. Cơ Chế Đồng Bộ Trạng Thái & Tác Động Đơn Hàng

Hệ thống Vestora kết hợp **3 lớp đồng bộ** đảm bảo tính toàn vẹn và tức thì của trạng thái:
1. **GHN Webhook (`POST /api/shipping/webhook/ghn`)**: Tiếp nhận tức thì sự kiện từ GHN khi bưu tá quét mã vạch.
2. **Live-Sync thời gian thực**: Tự động gọi GHN API cập nhật trạng thái ngay khi Branch Manager vào xem danh sách/chi tiết đơn hàng hoặc khi Khách hàng tra cứu đơn.
3. **Fallback Polling Job**: Tiến trình chạy ngầm mỗi 2 phút (`startShipmentSyncJob`) đối soát các vận đơn đang luân chuyển (`preparing`, `shipped`) để phòng ngừa trường hợp mất tín hiệu Webhook.

### Bảng Ánh Xạ Trạng Thái & Tác Động:
| Trạng thái GHN | Trạng thái Vận đơn (`OrderShipment`) | Hiển thị Khách hàng (`/tracking`) | Quản lý Chi nhánh (`/branch/rental-orders`) | Tác động Đơn hàng (`RentalOrder` / `SalesOrder`) |
|---|---|---|---|---|
| *(Chưa tạo vận đơn)* | *(Chưa có)* | **Chờ lấy hàng** *(Đang chuẩn bị tại Shop)* | **Chờ giao trang phục** | Đơn giữ trạng thái `confirmed`. Có nút `+ Tạo vận đơn GHN`. |
| `ready_to_pick` / `picking` | `preparing` | **Chờ lấy hàng** *(Đã bàn giao GHN)* | **Chờ lấy hàng** | Giữ trạng thái `confirmed`. |
| `storing` / `transporting` / `delivering` | `shipped` | **Đang giao hàng** | **Đang giao hàng** | Giữ trạng thái `confirmed`. |
| **`delivered` (Giao thành công)** | **`delivered`** | **Giao thành công (Đang thuê)** / **Giao hàng thành công** | **Đang thuê** / **Hoàn thành** | • **Đơn Bán**: Tự động chuyển `completed`.<br>• **Đơn Thuê**: Tự động chuyển `renting`, cập nhật ngày nhận đồ `startDate = actionTime`, đồng thời **tự động gia hạn `dueDate = startDate + thời_lượng_thuê_gốc`** để đảm bảo khách nhận đủ 100% số ngày thuê. |
| `cancel` | `cancelled` | **Vận đơn đang được chuẩn bị lại** / **Vận đơn đã hủy** | **Vận đơn đã hủy (Cần tạo lại)** | **Không hủy đơn hàng của khách.** Giữ trạng thái `confirmed`, mở lại nút **`+ Tạo vận đơn GHN`** để quản lý chi nhánh tạo vận đơn thay thế. |
| `delivery_fail` | `failed` | **Giao hàng thất bại** | **Giao hàng thất bại** | Giữ nguyên đơn, cho phép quản lý chi nhánh bấm nút **"Giao lại"**. |

---

## 4. Phân Biệt "Đã Hủy" vs "Vận Đơn Đã Hủy"

| Tiêu chí | "Đã Hủy" (Order Cancelled) | "Vận Đơn Đã Hủy" (Shipment Cancelled) |
|---|---|---|
| **Cấp độ** | **Đơn hàng tổng** (`RentalOrder` / `SalesOrder`) | **Vận đơn GHN** (`OrderShipment`) |
| **Bản chất** | Hợp đồng giao dịch chấm dứt hoàn toàn. | Chỉ có mã vận đơn giao hàng bị hủy (do sai thông tin, đổi shipper...). Đơn thuê vẫn còn hiệu lực. |
| **Tiền cọc** | Kích hoạt luồng hoàn cọc / hoàn tiền cho khách. | Tiền cọc được bảo lưu nguyên vẹn trên hệ thống. |
| **Thao tác tiếp theo** | Đơn đóng vĩnh viễn, không thể thao tác thêm. | Quản lý chi nhánh mở modal chi tiết đơn, bấm **`+ Tạo vận đơn GHN`** để tạo lại mã mới gửi bưu tá. |

---

## 5. Hướng Dẫn Thao Tác Cho Quản Lý Chi Nhánh (Branch Manager)

1. **Tạo vận đơn xuất hàng (Outbound Shipment):**
   - Vào mục **Quản lý đơn hàng** ➔ Bấm chi tiết đơn thuê (`confirmed`) hoặc đơn bán (`confirmed`/`processing`).
   - Tại **Section 4: Vận Chuyển & Giao Nhận (GHN)** ➔ Bấm **"+ Tạo vận đơn GHN"**.
   - **Địa giới 2 cấp chuẩn hóa**: Chọn Tỉnh/Thành phố và Phường/Xã giao hàng (hệ thống tự động gom các phường theo tỉnh và phân giải ngầm Quận/Huyện cho GHN).
   - **Tự động chuẩn hóa số điện thoại**: Hỗ trợ đầy đủ định dạng số di động 10 số hiện hành tại Việt Nam (kể cả đầu số quốc tế `+84` hay `84`).
   - **Cước phí**: Cửa hàng/Showroom chi trả cước vận chuyển trước cho GHN.
   - **Tiền thu hộ COD**: Hệ thống tự động tính toán chính xác theo dư nợ còn lại của đơn hàng/tiền cọc (nếu đã thanh toán online 100% thì COD = 0đ).
   - Bấm **"Kiểm tra cước phí"** để xem trước cước phí và ngày giao dự kiến.
   - Bấm **"Xác nhận tạo đơn GHN"** ➔ Vận đơn được tạo ngay lập tức với mã vận đơn GHN chính thức (`trackingCode`). Danh sách đơn hàng bên ngoài tự động làm mới ngay khi đóng modal.

2. **In phiếu giao hàng A5:**
   - Trên card vận đơn vừa tạo, bấm nút **"In phiếu A5"** ➔ Mở tab in phiếu trực tiếp từ hệ thống GHN API (`printA5`).

3. **Hủy vận đơn:**
   - Khi đơn ở trạng thái `Chờ lấy hàng` (`preparing`), quản lý chi nhánh có thể bấm **"Hủy vận đơn"** (nhập lý do hủy).
   - Hệ thống sẽ gọi API GHN để hủy lượt lấy hàng của bưu tá và chuyển vận đơn sang trạng thái `cancelled`. Đơn thuê của khách vẫn được giữ nguyên và nút tạo đơn được mở lại.

4. **Tạo đơn thu hồi đồ thuê (Return Shipment):**
   - Áp dụng khi đơn thuê đang ở trạng thái `renting`, `partially_returned` hoặc `overdue`.
   - Bấm **"+ Thu hồi đồ thuê"** ➔ Bưu tá GHN sẽ đến địa chỉ của khách hàng nhận lại trang phục và giao trả về đúng Showroom Cửa hàng chi nhánh phụ trách đơn.

5. **Xử lý khi giao thất bại:**
   - Nếu khách hẹn lại hoặc không liên lạc được, vận đơn chuyển sang `failed`.
   - Quản lý chi nhánh chỉ cần bấm nút **"Giao lại"** trên card vận đơn để tạo lượt giao mới.

---

## 6. Kiến Trúc Vận Chuyển Đa Chi Nhánh (Multi-Store Shipping)

1. **Mỗi đơn hàng gắn liền với Cửa hàng chi nhánh cụ thể (`fromShopId`):**
   - Điểm lấy hàng xuất đi (`from_name`, `from_phone`, `from_address`, GPS `latitude`/`longitude`) được lấy trực tiếp từ Showroom Cửa hàng sở hữu đơn.
   - Bưu tá GHN đến đúng địa chỉ Showroom của Cửa hàng đó để nhận hàng, **không phụ thuộc vào 1 địa chỉ kho cố định duy nhất**.
2. **Đơn thu hồi đồ thuê (Return Shipment):**
   - Bưu tá nhận đồ từ nhà khách và giao trả về đúng Showroom Cửa hàng đã xuất đồ ban đầu.
3. **Phân quyền chặt chẽ (Branch RBAC):**
   - Quản lý chi nhánh chỉ có quyền thao tác tạo, hủy hoặc in vận đơn đối với các đơn hàng thuộc phạm vi chi nhánh được phân công.

---

## 7. Theo Dõi Đơn Hàng & Tiến Trình GHN Cho Khách Hàng (Customer Order Tracking)

- **Kiến trúc Tinh gọn 100% Authenticated In-App Tracking:**
  - Xóa bỏ hoàn toàn màn hình tra cứu độc lập (`CustomerOrderTrackingPage.js`) và gỡ bỏ menu *"Tra Cứu Đơn"*.
  - Mọi đường dẫn `/tracking` và `/tracking/:code` đều được tự động chuyển hướng về trang **Lịch Sử Đơn Hàng / Đơn Thuê Của Tôi** (`/rental-orders?code=:code`).
  - Giao diện `RentalOrdersHistoryPage` tự động mở **Popup Modal** (`OrderTrackingDetailModal.js`) đúng đơn hàng tương ứng với mã truyền vào.
- **Bảo Mật API Xác Thực 100% (JWT & RBAC):**
  - Endpoint theo dõi: `GET /api/shipping/track/:trackingCode` yêu cầu đăng nhập (`authMiddleware`).
  - Kiểm soát quyền chặt chẽ: Khách hàng chỉ được xem đơn hàng của chính mình (`customerId === req.user._id`). Bị chặn `403 Forbidden` nếu truy cập đơn của người khác. Nhân viên chi nhánh/Admin được phép truy cập để hỗ trợ khách.
  - Loại bỏ hoàn toàn các hàm che mờ PII thủ công (masking) và middleware rate-limit chống cào do toàn bộ dữ liệu chỉ trả về cho chính chủ đã xác thực.
- **Thanh tiến trình trực quan trong Popup:**
  - Stepper 4 bước chuẩn GHN: *Tiếp nhận / Chờ xác nhận ➔ Chờ lấy hàng ➔ Đang giao hàng ➔ Giao thành công*.
  - Tích hợp 3 thẻ thông tin (Người nhận, Showroom gửi/thu hồi, Thời gian dự kiến), danh sách trang phục kèm ảnh, chi tiết tài chính và nút đồng bộ trực tiếp (`Live-Sync`) từ GHN API.

---

## 8. Chạy Script Kiểm Thử Tự Động

Để kiểm tra nhanh tính tương thích của toàn bộ module:
```bash
cd backend
node src/scripts/testGhnFlow.js
```
Kết quả `7/7 TESTS PASSED` xác nhận toàn bộ hệ thống đã sẵn sàng vận hành.
