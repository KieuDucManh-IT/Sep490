import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "../../styles/WardrobePage.css";
import wardrobeApi from "../../services/wardrobeApi";

export default function WardrobePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Đọc query param ?filter=...
  const queryParams = new URLSearchParams(location.search);
  const initialFilter = queryParams.get("filter") || "all";

  const [activeTab, setActiveTab] = useState(initialFilter);
  const [wardrobeList, setWardrobeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removedAlert, setRemovedAlert] = useState("");

  // Tải danh sách tủ đồ thật từ backend
  const loadWardrobe = async () => {
    try {
      setLoading(true);
      const items = await wardrobeApi.getWardrobe();
      setWardrobeList(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error("Lỗi tải tủ đồ từ backend:", err);
      setWardrobeList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWardrobe();
  }, []);

  const handleRemove = async (e, id, title) => {
    e.stopPropagation();
    try {
      await wardrobeApi.removeFromWardrobe(id);
      setWardrobeList((prev) => prev.filter((item) => (item._id || item.id) !== id));
      setRemovedAlert(`Đã bỏ "${title}" khỏi tủ đồ cá nhân`);
      setTimeout(() => setRemovedAlert(""), 3500);
    } catch (err) {
      console.error("Lỗi khi xoá trang phục:", err);
      alert("Không thể xoá trang phục, vui lòng thử lại.");
    }
  };

  const filteredItems = wardrobeList.filter((item) => {
    const itemTags = Array.isArray(item.tags) ? item.tags : [];
    if (activeTab === "all") return true;
    if (activeTab === "ai-suggested") return itemTags.includes("ai-suggested");
    if (activeTab === "tryon-history") return itemTags.includes("tryon-history") || Boolean(item.tryOnImageUrl);
    if (activeTab === "party") return itemTags.includes("party") || /dạ hội|tiệc/i.test(item.category || "");
    if (activeTab === "work") return itemTags.includes("work") || /công sở|vest/i.test(item.category || "");
    return true;
  });

  const formatPrice = (val) => new Intl.NumberFormat("vi-VN").format(val || 0) + "đ";

  return (
    <div className="vestora-page-wrapper">
      <Navbar />

      <main className="wardrobe-main-container">
        {/* Header Section */}
        <header className="wardrobe-header-card">
          <div className="header-text-group">
            <span className="wardrobe-tagline">
              <i className="fa-solid fa-wand-magic-sparkles"></i> BỘ SƯU TẬP AI STYLIST
            </span>
            <h1 className="wardrobe-title">Tủ Đồ Cá Nhân Của Bạn</h1>
            <p className="wardrobe-description">
              Nơi lưu trữ những bộ trang phục bạn đã thử qua AI Virtual Try-On và các trang phục được gợi ý.
              Ướm thử lại bất kỳ lúc nào hoặc tiến hành đặt thuê/mua nhanh chóng.
            </p>
          </div>

          <div className="header-action-group">
            <button
              className="btn-header-tryon"
              onClick={() => navigate("/try-on/photo")}
            >
              <i className="fa-solid fa-camera"></i> Ướm thử AI mới
            </button>
            <button
              className="btn-header-explore"
              onClick={() => navigate("/catalog")}
            >
              <i className="fa-solid fa-compass"></i> Khám phá thêm
            </button>
          </div>
        </header>

        {/* Status Notification Toast */}
        {removedAlert && (
          <div className="wardrobe-toast-alert">
            <i className="fa-solid fa-circle-check"></i> {removedAlert}
          </div>
        )}

        {/* Quick Stats Bar */}
        <div className="wardrobe-stats-bar">
          <div className="stat-box">
            <span className="stat-number">{wardrobeList.length}</span>
            <span className="stat-label">Trang phục đã lưu</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-box">
            <span className="stat-number">
              {wardrobeList.filter((i) => i.tryOnImageUrl || (Array.isArray(i.tags) && i.tags.includes("tryon-history"))).length}
            </span>
            <span className="stat-label">Ảnh đã ghép AI</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-box">
            <span className="stat-number">
              {wardrobeList.filter((i) => Array.isArray(i.tags) && i.tags.includes("ai-suggested")).length}
            </span>
            <span className="stat-label">AI Stylist gợi ý</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-box">
            <span className="stat-number">98%</span>
            <span className="stat-label">Độ tương thích chuẩn</span>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="wardrobe-filter-tabs">
          <button
            className={`w-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <i className="fa-solid fa-layer-group"></i> Tất cả ({wardrobeList.length})
          </button>
          <button
            className={`w-tab-btn ${activeTab === "tryon-history" ? "active" : ""}`}
            onClick={() => setActiveTab("tryon-history")}
          >
            <i className="fa-solid fa-camera"></i> Đã thử bằng AI (
            {wardrobeList.filter((i) => i.tryOnImageUrl || (Array.isArray(i.tags) && i.tags.includes("tryon-history"))).length})
          </button>
          <button
            className={`w-tab-btn ${activeTab === "ai-suggested" ? "active" : ""}`}
            onClick={() => setActiveTab("ai-suggested")}
          >
            <i className="fa-solid fa-sparkles"></i> Gợi ý AI Stylist (
            {wardrobeList.filter((i) => Array.isArray(i.tags) && i.tags.includes("ai-suggested")).length})
          </button>
          <button
            className={`w-tab-btn ${activeTab === "party" ? "active" : ""}`}
            onClick={() => setActiveTab("party")}
          >
            <i className="fa-solid fa-champagne-glasses"></i> Dự tiệc & Lễ hội
          </button>
          <button
            className={`w-tab-btn ${activeTab === "work" ? "active" : ""}`}
            onClick={() => setActiveTab("work")}
          >
            <i className="fa-solid fa-briefcase"></i> Công sở & Thanh lịch
          </button>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "3px solid rgba(0,0,0,0.1)",
                borderTopColor: "var(--color-gold, #D4AF37)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px auto",
              }}
            />
            <p>Đang tải tủ đồ cá nhân từ hệ thống...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="wardrobe-empty-state">
            <div className="empty-icon-wrap">
              <i className="fa-solid fa-shirt"></i>
            </div>
            <h3>Tủ đồ của bạn chưa có trang phục trong mục này</h3>
            <p>Hãy trải nghiệm tính năng thử đồ AI hoặc khám phá bộ sưu tập để lưu các bộ outfit ưng ý vào tủ đồ.</p>
            <div className="empty-btn-group">
              <button
                className="btn-empty-primary"
                onClick={() => navigate("/try-on/photo")}
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> Thử đồ với AI ngay
              </button>
              <button
                className="btn-empty-outline"
                onClick={() => navigate("/catalog")}
              >
                Xem tất cả trang phục
              </button>
            </div>
          </div>
        ) : (
          <div className="wardrobe-cards-grid">
            {filteredItems.map((item) => {
              const itemId = item._id || item.id;
              const productTargetId = item.productId || item.productCode || itemId;
              const displayImage = item.tryOnImageUrl || item.image;

              return (
                <div key={itemId} className="wardrobe-item-card">
                  {/* Media Container */}
                  <div className="item-media-container">
                    <img
                      src={displayImage}
                      alt={item.title}
                      className="item-thumbnail"
                      onClick={() => navigate(`/product/${productTargetId}`)}
                      style={{ cursor: "pointer" }}
                    />

                    {/* AI Try-on Badge nếu có ảnh thử đồ */}
                    {item.tryOnImageUrl && (
                      <span className="item-tryon-badge">
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Ảnh thử AI
                      </span>
                    )}

                    {/* AI Match Badge */}
                    <div className="item-ai-match-badge">
                      <i className="fa-solid fa-sparkles"></i> {item.matchScore || 98}% Hợp dáng
                    </div>

                    {/* Remove Button */}
                    <button
                      className="btn-remove-item"
                      title="Bỏ lưu khỏi tủ đồ"
                      onClick={(e) => handleRemove(e, itemId, item.title)}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>

                    {/* Type Badge */}
                    <span className={`item-type-badge badge-${item.typeBadge || "rental"}`}>
                      {item.typeBadge === "sale" ? "Mua bán" : "Thuê đồ"}
                    </span>
                  </div>

                  {/* Details Container */}
                  <div className="item-details-container">
                    <div className="item-category-line">
                      <span className="item-category-tag">{item.category}</span>
                      <span className="item-saved-date">
                        {item.savedDate ? `Lưu ngày: ${item.savedDate}` : ""}
                      </span>
                    </div>

                    <h3 className="item-title">
                      <Link to={`/product/${productTargetId}`}>{item.title}</Link>
                    </h3>

                    {/* AI Stylist Note */}
                    <div className="item-ai-note-box">
                      <i className="fa-solid fa-quote-left note-quote-icon"></i>
                      <p>{item.aiNote || "Trang phục vừa vặn và tôn vóc dáng của bạn."}</p>
                    </div>

                    {/* Pricing and Action Buttons */}
                    <div className="item-footer-row">
                      <div className="item-price-col">
                        <span className="price-number">{formatPrice(item.price)}</span>
                        {item.priceUnit && <span className="price-sub">{item.priceUnit}</span>}
                      </div>

                      <div className="item-actions-col">
                        <button
                          className="btn-tryon-again"
                          title="Ướm thử lại bằng AI"
                          onClick={() => navigate(`/try-on/photo?product=${productTargetId}`)}
                        >
                          <i className="fa-solid fa-camera"></i> Thử lại
                        </button>
                        <button
                          className="btn-rent-now"
                          onClick={() => navigate(`/product/${productTargetId}`)}
                        >
                          Xem chi tiết
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
