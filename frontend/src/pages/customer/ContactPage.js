import React, { useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "../../styles/ContactPage.css";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="vestora-page-wrapper">
      <Navbar />
      <main className="contact-main-container">
        <header className="contact-header-section">
          <span className="contact-subtitle">KẾT NỐI VỚI CHÚNG TÔI</span>
          <h1 className="contact-title">Liên Hệ VESTORA</h1>
          <p className="contact-lead">
            Chúng tôi luôn sẵn sàng lắng nghe, hỗ trợ giải đáp mọi thắc mắc và hợp tác cùng bạn.
          </p>
        </header>

        <div className="contact-layout-grid">
          {/* Contact Info Col */}
          <div className="contact-info-col">
            <div className="contact-info-box">
              <h3>Thông Tin Liên Hệ</h3>
              <p className="box-sub">Liên hệ trực tiếp qua các kênh hỗ trợ khách hàng và đối tác:</p>

              <div className="contact-point-list">
                <div className="contact-point-item">
                  <div className="point-icon"><i className="fa-solid fa-location-dot"></i></div>
                  <div>
                    <strong>Địa chỉ Showroom</strong>
                    <p>Tầng 5, 123 Nguyễn Văn Cừ, Long Biên, Hà Nội</p>
                  </div>
                </div>

                <div className="contact-point-item">
                  <div className="point-icon"><i className="fa-solid fa-phone"></i></div>
                  <div>
                    <strong>Hotline chăm sóc khách hàng</strong>
                    <p>1900 1234 (8:00 - 21:00 hàng ngày)</p>
                  </div>
                </div>

                <div className="contact-point-item">
                  <div className="point-icon"><i className="fa-solid fa-envelope"></i></div>
                  <div>
                    <strong>Email hỗ trợ</strong>
                    <p>support@vestora.vn</p>
                  </div>
                </div>

                <div className="contact-point-item">
                  <div className="point-icon"><i className="fa-solid fa-clock"></i></div>
                  <div>
                    <strong>Thời gian làm việc</strong>
                    <p>Thứ Hai - Chủ Nhật: 08:30 - 21:30</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Col */}
          <div className="contact-form-col">
            <div className="contact-form-card">
              <h3>Gửi Lời Nhắn</h3>
              {submitted ? (
                <div className="contact-success-alert">
                  <i className="fa-solid fa-circle-check"></i>
                  <h4>Cảm ơn bạn đã liên hệ!</h4>
                  <p>Chúng tôi đã nhận được thông tin và sẽ phản hồi sớm nhất qua email của bạn.</p>
                  <button type="button" onClick={() => setSubmitted(false)} className="btn-send-again">
                    Gửi tin nhắn khác
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Họ và tên *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nguyễn Văn A"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Số điện thoại *</label>
                      <input
                        type="tel"
                        required
                        placeholder="0987 654 321"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Chủ đề cần hỗ trợ</label>
                    <input
                      type="text"
                      placeholder="Thuê đồ, ký gửi sản phẩm, thử đồ AI..."
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Nội dung tin nhắn *</label>
                    <textarea
                      rows="4"
                      required
                      placeholder="Nhập nội dung cần hỗ trợ chi tiết..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    ></textarea>
                  </div>

                  <button type="submit" className="btn-contact-submit">
                    Gửi yêu cầu hỗ trợ <i className="fa-solid fa-paper-plane"></i>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
