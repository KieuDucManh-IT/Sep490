import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "../../styles/WardrobePage.css";

// Danh sách trang phục mẫu AI gợi ý đã được lưu vào tủ đồ cá nhân
const INITIAL_WARDROBE_ITEMS = [
  {
    id: "VESTORA-DR-089",
    title: "Đầm dạ hội ánh tím xẻ tà",
    image: "/assets/purple_gown.jpg",
    category: "Dự tiệc",
    typeBadge: "rental",
    matchScore: 98,
    savedDate: "28/10/2026",
    aiNote: "Form dáng cúp ngực kết hợp tà xòe mềm mại, tôn chiều cao và đường cong cho tiệc đêm sang trọng.",
    price: 350000,
    priceUnit: "/ 3 ngày",
    tags: ["ai-suggested", "party", "rental"],
  },
  {
    id: "VESTORA-BZ-012",
    title: "Blazer thanh lịch màu be",
    image: "/assets/beige_blazer.jpg",
    category: "Công sở",
    typeBadge: "resale",
    matchScore: 95,
    savedDate: "27/10/2026",
    aiNote: "Tone be trung tính thanh lịch, dễ phối cùng quần âu hoặc chân váy bút chì cho phong thái chuyên nghiệp.",
    price: 180000,
    priceUnit: "",
    tags: ["ai-suggested", "work", "resale"],
  },
  {
    id: "VESTORA-AD-007",
    title: "Áo dài cách tân hồng phấn thêu hoa",
    image: "/assets/ao_dai.jpg",
    category: "Lễ hội & Sự kiện",
    typeBadge: "rental",
    matchScore: 97,
    savedDate: "26/10/2026",
    aiNote: "Được AI chấm điểm 97% phù hợp với nước da sáng, chất lụa tơ sống bay bổng cho dịp lễ Tết hoặc kỷ yếu.",
    price: 250000,
    priceUnit: "/ 3 ngày",
    tags: ["ai-suggested", "tryon-history", "party", "rental"],
  },
  {
    id: "VESTORA-BG-045",
    title: "Túi xách dây tiệc mini chần chỉ",
    image: "/assets/mini_bag.jpg",
    category: "Phụ kiện",
    typeBadge: "resale",
    matchScore: 92,
    savedDate: "25/10/2026",
    aiNote: "Phụ kiện hoàn hảo để phối cùng đầm dạ hội ánh tím hoặc đầm body đen khi dự tiệc nhẹ.",
    price: 120000,
    priceUnit: "",
    tags: ["party", "resale"],
  },
  {
    id: "VESTORA-BD-022",
    title: "Đầm body đen cúp tim quyến rũ",
    image: "/assets/black_dress.jpg",
    category: "Dự tiệc",
    typeBadge: "rental",
    matchScore: 96,
    savedDate: "24/10/2026",
    aiNote: "Đã thử qua AI Try-On thành công. Thiết kế ôm sát cơ thể, tạo cảm giác thon gọn và cuốn hút.",
    price: 300000,
    priceUnit: "/ 3 ngày",
    tags: ["tryon-history", "party", "rental"],
  },
];

export default function WardrobePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Đọc query param ?filter=...
  const queryParams = new URLSearchParams(location.search);
  const initialFilter = queryParams.get("filter") || "all";

  const [activeTab, setActiveTab] = useState(initialFilter);
  const [wardrobeList, setWardrobeList] = useState(INITIAL_WARDROBE_ITEMS);
  const [removedAlert, setRemovedAlert] = useState("");

  const handleRemove = (e, id, title) => {
    e.stopPropagation();
    setWardrobeList((prev) => prev.filter((item) => item.id !== id));
    setRemovedAlert(`Đã bỏ "${title}" khỏi tủ đồ cá nhân`);
    setTimeout(() => setRemovedAlert(""), 3500);
  };

  const filteredItems = wardrobeList.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "ai-suggested") return item.tags.includes("ai-suggested");
    if (activeTab === "tryon-history") return item.tags.includes("tryon-history");
    if (activeTab === "party") return item.tags.includes("party");
    if (activeTab === "work") return item.tags.includes("work");
    return true;
  });

  const formatPrice = (val) => new Intl.NumberFormat("vi-VN").format(val) + "đ";

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
              Nơi lưu trữ những bộ trang phục được AI gợi ý dựa trên phong cách, sở thích và vóc dáng của bạn.
              Ướm thử lại bất kỳ lúc nào hoặc tiến hành thuê/mua chỉ với một cú click.
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
              {wardrobeList.filter((i) => i.tags.includes("ai-suggested")).length}
            </span>
            <span className="stat-label">AI Stylist gợi ý</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-box">
            <span className="stat-number">
              {wardrobeList.filter((i) => i.tags.includes("tryon-history")).length}
            </span>
            <span className="stat-label">Đã thử qua AI / Camera</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-box">
            <span className="stat-number">96.5%</span>
            <span className="stat-label">Độ tương thích trung bình</span>
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
            className={`w-tab-btn ${activeTab === "ai-suggested" ? "active" : ""}`}
            onClick={() => setActiveTab("ai-suggested")}
          >
            <i className="fa-solid fa-sparkles"></i> Gợi ý AI Stylist (
            {wardrobeList.filter((i) => i.tags.includes("ai-suggested")).length})
          </button>
          <button
            className={`w-tab-btn ${activeTab === "tryon-history" ? "active" : ""}`}
            onClick={() => setActiveTab("tryon-history")}
          >
            <i className="fa-solid fa-camera"></i> Đã thử bằng AI (
            {wardrobeList.filter((i) => i.tags.includes("tryon-history")).length})
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

        {/* Wardrobe Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="wardrobe-empty-state">
            <div className="empty-icon-wrap">
              <i className="fa-solid fa-shirt"></i>
            </div>
            <h3>Tủ đồ của bạn chưa có trang phục trong mục này</h3>
            <p>Hãy trải nghiệm tính năng thử đồ AI hoặc khám phá bộ sưu tập để thêm các trang phục ưng ý vào tủ đồ.</p>
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
            {filteredItems.map((item) => (
              <div key={item.id} className="wardrobe-item-card">
                {/* Media Container */}
                <div className="item-media-container">
                  <img src={item.image} alt={item.title} className="item-thumbnail" />

                  {/* AI Match Badge */}
                  <div className="item-ai-match-badge">
                    <i className="fa-solid fa-sparkles"></i> {item.matchScore}% Hợp dáng
                  </div>

                  {/* Remove Button */}
                  <button
                    className="btn-remove-item"
                    title="Bỏ lưu khỏi tủ đồ"
                    onClick={(e) => handleRemove(e, item.id, item.title)}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>

                  {/* Type Badge */}
                  <span className={`item-type-badge badge-${item.typeBadge}`}>
                    {item.typeBadge === "rental" ? "Thuê đồ" : "Mua cũ"}
                  </span>
                </div>

                {/* Details Container */}
                <div className="item-details-container">
                  <div className="item-category-line">
                    <span className="item-category-tag">{item.category}</span>
                    <span className="item-saved-date">Lưu ngày: {item.savedDate}</span>
                  </div>

                  <h3 className="item-title">
                    <Link to={`/product/${item.id}`}>{item.title}</Link>
                  </h3>

                  {/* AI Stylist Note */}
                  <div className="item-ai-note-box">
                    <i className="fa-solid fa-quote-left note-quote-icon"></i>
                    <p>{item.aiNote}</p>
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
                        onClick={() => navigate("/try-on/photo")}
                      >
                        <i className="fa-solid fa-camera"></i> Thử lại
                      </button>
                      <button
                        className="btn-rent-now"
                        onClick={() => navigate(`/product/${item.id}`)}
                      >
                        Thuê ngay
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
