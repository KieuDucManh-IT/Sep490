import React, { useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "../../styles/PolicyPage.css";

export default function PolicyPage() {
  const [activeTab, setActiveTab] = useState("rental");

  return (
    <div className="vestora-page-wrapper">
      <Navbar />
      <main className="policy-main-container">
        <header className="policy-header-section">
          <span className="policy-subtitle">CHÍNH SÁCH & QUY ĐỊNH</span>
          <h1 className="policy-title">Chính Sách Hoạt Động Min.De</h1>
          <p className="policy-lead">
            Minh bạch, an toàn và bảo vệ quyền lợi tối đa cho khách hàng và đối tác cho thuê.
          </p>
        </header>

        {/* Tab Switcher */}
        <div className="policy-tab-bar">
          <button
            className={`policy-tab-btn ${activeTab === "rental" ? "active" : ""}`}
            onClick={() => setActiveTab("rental")}
          >
            <i className="fa-solid fa-shirt"></i> Chính sách thuê đồ
          </button>
          <button
            className={`policy-tab-btn ${activeTab === "escrow" ? "active" : ""}`}
            onClick={() => setActiveTab("escrow")}
          >
            <i className="fa-solid fa-shield-halved"></i> Thanh toán Escrow & Đặt cọc
          </button>
          <button
            className={`policy-tab-btn ${activeTab === "return" ? "active" : ""}`}
            onClick={() => setActiveTab("return")}
          >
            <i className="fa-solid fa-box-open"></i> Đổi trả & Hoàn cọc
          </button>
          <button
            className={`policy-tab-btn ${activeTab === "privacy" ? "active" : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            <i className="fa-solid fa-lock"></i> Bảo mật thông tin
          </button>
        </div>

        {/* Content Box */}
        <div className="policy-content-card">
          {activeTab === "rental" && (
            <div className="policy-article">
              <h2>1. Quy Định Thuê Đồ Thời Trang</h2>
              <p>
                Khách hàng được lựa chọn thời gian thuê linh hoạt từ 3 đến 7 ngày hoặc theo thỏa thuận riêng với shop đối tác.
              </p>
              <h3>Quyền lợi và nghĩa vụ của người thuê:</h3>
              <ul>
                <li>Được nhận trang phục đúng mẫu mã, màu sắc, tình trạng như mô tả trên website.</li>
                <li>Trang phục được giặt khô, là ủi và bảo quản trong túi bọc chuyên dụng trước khi giao.</li>
                <li>Người thuê không tự ý tẩy rửa bằng hóa chất mạnh hoặc sửa chữa form dáng của trang phục.</li>
                <li>Hoàn trả đúng thời hạn thỏa thuận để tránh phát sinh phụ phí giữ đồ.</li>
              </ul>
            </div>
          )}

          {activeTab === "escrow" && (
            <div className="policy-article">
              <h2>2. Cơ Chế Thanh Toán Escrow & Bảo Lãnh Tiền Cọc</h2>
              <p>
                Hệ thống ví ký quỹ Escrow của VESTORA đảm bảo tiền cọc của bạn được giữ an toàn tuyệt đối 100%.
              </p>
              <h3>Quy trình ký quỹ an toàn:</h3>
              <ul>
                <li>Số tiền cọc sẽ được chuyển vào tài khoản Escrow trung gian có xác thực.</li>
                <li>Shop chỉ nhận tiền thanh toán thuê sau khi khách hàng đã nhận đồ đúng cam kết.</li>
                <li>Khi đơn hàng hoàn tất và đồ được trả về nguyên vẹn, tiền cọc sẽ tự động được hoàn trả vào tài khoản của khách trong vòng 24 giờ.</li>
              </ul>
            </div>
          )}

          {activeTab === "return" && (
            <div className="policy-article">
              <h2>3. Chính Sách Đổi Trả & Hoàn Cọc</h2>
              <p>
                Chúng tôi tạo điều kiện tối đa để khách hàng có trải nghiệm ưng ý nhất khi thuê và mua đồ.
              </p>
              <h3>Điều kiện đổi trả:</h3>
              <ul>
                <li>Hỗ trợ đổi kích cỡ (size) trong vòng 12h kể từ khi nhận hàng nếu trang phục không vừa vặn.</li>
                <li>Được hủy đơn và hoàn 100% tiền cọc nếu thông báo trước 48 giờ tính đến thời điểm nhận đồ dự kiến.</li>
                <li>Mọi trường hợp khiếu nại về hư hỏng hay sai mẫu đều được đội ngũ kiểm định hỗ trợ xử lý công bằng.</li>
              </ul>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="policy-article">
              <h2>4. Bảo Mật Thông Tin & Dữ Liệu AI</h2>
              <p>
                VESTORA cam kết bảo vệ toàn diện thông tin cá nhân và hình ảnh khách hàng cung cấp.
              </p>
              <h3>Chính sách bảo mật hình ảnh thử đồ AI:</h3>
              <ul>
                <li>Ảnh khuôn mặt hoặc toàn thân tải lên chỉ phục vụ quá trình tạo ảnh mô phỏng thử đồ.</li>
                <li>Dữ liệu camera và hình ảnh thử đồ KHÔNG được chia sẻ cho bên thứ ba vì mục đích thương mại.</li>
                <li>Khách hàng có toàn quyền xóa dữ liệu ảnh và lịch sử thử đồ bất kỳ lúc nào trong phần cài đặt tài khoản.</li>
              </ul>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
