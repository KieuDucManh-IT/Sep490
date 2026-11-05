import React from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "../../styles/AboutPage.css";

export default function AboutPage() {
  return (
    <div className="vestora-page-wrapper">
      <Navbar />
      <main className="about-main-container">
        {/* Hero Section */}
        <section className="about-hero-section">
          <span className="about-subtitle">VỀ CHÚNG TÔI</span>
          <h1 className="about-title">Câu Chuyện Về VESTORA</h1>
          <p className="about-lead">
            Nền tảng tiên phong kết hợp công nghệ AI thử đồ và thời trang tuần hoàn,
            mang đến giải pháp thuê và mua sắm thông minh, sang trọng và bền vững.
          </p>
        </section>

        {/* Brand Mission & Vision Grid */}
        <section className="about-grid-section">
          <div className="about-card">
            <div className="about-card-icon">
              <i className="fa-solid fa-sparkles"></i>
            </div>
            <h3>Sứ Mệnh</h3>
            <p>
              Giúp mọi tín đồ thời trang tự tin tỏa sáng trong mọi dịp quan trọng mà không cần
              phải chi trả quá nhiều hay lãng phí trang phục chỉ mặc một lần.
            </p>
          </div>

          <div className="about-card">
            <div className="about-card-icon">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <h3>Công Nghệ Tiên Phong</h3>
            <p>
              Ứng dụng mô hình AI và AR thử đồ chuẩn xác, cho phép khách hàng ướm thử trang phục
              chân thực qua ảnh và webcam trước khi quyết định thuê hoặc mua.
            </p>
          </div>

          <div className="about-card">
            <div className="about-card-icon">
              <i className="fa-solid fa-leaf"></i>
            </div>
            <h3>Thời Trang Bền Vững</h3>
            <p>
              Thúc đẩy lối sống xanh qua việc chia sẻ, cho thuê và tái sử dụng trang phục chất lượng
              cao, giảm thiểu lượng rác thải dệt may ra môi trường.
            </p>
          </div>
        </section>

        {/* Commitment */}
        <section className="about-commitment-section">
          <h2>Cam Kết Dịch Vụ</h2>
          <div className="commitment-list">
            <div className="commitment-item">
              <i className="fa-solid fa-shield-check"></i>
              <div>
                <strong>Bảo chứng chất lượng</strong>
                <p>100% trang phục được giặt hấp, khử trùng và kiểm định kỹ trước khi giao.</p>
              </div>
            </div>
            <div className="commitment-item">
              <i className="fa-solid fa-truck-fast"></i>
              <div>
                <strong>Giao hàng hỏa tốc</strong>
                <p>Nhận đồ nhanh chóng tận nơi, hỗ trợ đổi kích cỡ tiện lợi.</p>
              </div>
            </div>
            <div className="commitment-item">
              <i className="fa-solid fa-lock"></i>
              <div>
                <strong>Thanh toán an toàn Escrow</strong>
                <p>Tiền cọc và phí thuê được giữ bảo đảm minh bạch cho cả khách hàng và shop đối tác.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
