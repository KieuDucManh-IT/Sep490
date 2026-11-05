import React, { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { getPublicPolicies } from "../../services/businessPolicyService";
import {
  Sparkles,
  Phone,
  Mail,
  FileText,
  ChevronRight,
} from "lucide-react";
import "../../styles/PolicyPage.css";

function renderFormattedContent(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="policy-article-list">
          {currentList.map((item, idx) => (
            <li key={idx} className="policy-article-list-item">
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    // Tiêu đề mục số: vd "1. Thời Hạn Thuê" hoặc "I. Điều Kiện Chung"
    if (/^\d+\./.test(trimmed) || /^[IVXLCDM]+\./.test(trimmed)) {
      flushList();
      elements.push(
        <h3 key={`h3-${idx}`} className="policy-section-heading">
          <span className="policy-heading-marker" aria-hidden="true">
            <ChevronRight size={16} />
          </span>
          <span>{trimmed}</span>
        </h3>
      );
    }
    // Gạch đầu dòng: vd "- Nội dung" hoặc "* Nội dung"
    else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
      currentList.push(trimmed.substring(1).trim());
    } else {
      flushList();
      elements.push(
        <p key={`p-${idx}`} className="policy-article-paragraph">
          {trimmed}
        </p>
      );
    }
  });

  flushList();
  return elements;
}

export default function PolicyPage() {
  const [policies, setPolicies] = useState(null);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);

  // Tải danh sách chính sách công khai đang bật từ Backend
  useEffect(() => {
    let isMounted = true;
    const fetchPolicies = async () => {
      try {
        const data = await getPublicPolicies();
        if (data && isMounted) {
          setPolicies(data);
        }
      } catch (_) {
        // Dự phòng khi mất kết nối mạng
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPolicies();
    return () => {
      isMounted = false;
    };
  }, []);

  // Lọc danh sách tab đang kích hoạt từ dữ liệu database (isActive !== false)
  const availableTabs = useMemo(() => {
    if (!policies) return [];
    if (Array.isArray(policies)) {
      return policies
        .filter((p) => p.isActive !== false)
        .map((p) => ({
          key: p.key || p._id,
          label: p.title || p.key,
          title: p.title,
          summary: p.summary,
          content: p.content,
          isActive: p.isActive,
        }));
    }
    // Tương thích ngược nếu dữ liệu trả về dạng object
    return Object.entries(policies)
      .filter(([_, p]) => p?.isActive !== false)
      .map(([k, p]) => ({
        key: k,
        label: p?.title || k,
        title: p?.title,
        summary: p?.summary,
        content: p?.content,
        isActive: p?.isActive,
      }));
  }, [policies]);

  // Tự động kích hoạt tab đầu tiên khi tải xong dữ liệu
  useEffect(() => {
    if (availableTabs.length > 0 && (!activeTab || !availableTabs.some((t) => t.key === activeTab))) {
      setActiveTab(availableTabs[0].key);
    }
  }, [availableTabs, activeTab]);

  // Chuyển đổi tab có cuộn mềm vào tầm nhìn trên thiết bị di động
  const handleTabChange = useCallback((key) => {
    setActiveTab(key);
    const tabEl = document.getElementById(`customer-policy-tab-${key}`);
    if (tabEl && typeof tabEl.scrollIntoView === "function") {
      tabEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, []);

  // Xử lý điều hướng bằng bàn phím theo chuẩn WAI-ARIA cho Tabs
  const handleTabKeyDown = useCallback(
    (e, currentIndex) => {
      const total = availableTabs.length;
      if (total === 0) return;

      let nextIndex = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % total;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + total) % total;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = total - 1;
      }

      if (nextIndex !== null) {
        const nextKey = availableTabs[nextIndex].key;
        handleTabChange(nextKey);
        const nextButton = document.getElementById(`customer-policy-tab-${nextKey}`);
        if (nextButton) {
          nextButton.focus();
        }
      }
    },
    [availableTabs, handleTabChange]
  );

  // Đối tượng chính sách đang được kích hoạt
  const activePolicyData = useMemo(() => {
    if (!availableTabs.length) return null;
    return availableTabs.find((t) => t.key === activeTab) || availableTabs[0];
  }, [availableTabs, activeTab]);

  // Memoize nội dung phân tích định dạng để tránh re-parse khi state khác thay đổi
  const formattedContent = useMemo(() => {
    return renderFormattedContent(activePolicyData?.content);
  }, [activePolicyData?.content]);

  return (
    <div className="vestora-page-wrapper">
      <Navbar />

      <main className="policy-main-container">
        {/* Banner tiêu đề Cổng Khách Hàng */}
        <header className="policy-header-section">
          <h1 className="policy-title">Chính Sách Hoạt Động & Cho Thuê</h1>
          <p className="policy-lead">
            Cam kết minh bạch và bảo vệ tối đa quyền lợi khách hàng trong suốt quá trình thuê, đổi size, hoàn trả và bảo hiểm trang phục tại toàn bộ chuỗi showroom VESTORA.
          </p>
        </header>

        {/* Tab Switcher - Các Danh Mục Chính Sách Động từ Database */}
        {availableTabs.length > 0 && (
          <div
            className="policy-tab-bar"
            role="tablist"
            aria-label="Danh mục các chính sách hoạt động của chuỗi"
          >
            {availableTabs.map((t, idx) => {
              const isCurrent = activeTab === t.key;

              return (
                <button
                  key={t.key}
                  id={`customer-policy-tab-${t.key}`}
                  role="tab"
                  type="button"
                  tabIndex={isCurrent ? 0 : -1}
                  aria-selected={isCurrent}
                  aria-controls={`customer-policy-panel-${t.key}`}
                  className={`policy-tab-btn ${isCurrent ? "active" : ""}`}
                  onClick={() => handleTabChange(t.key)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                >
                  <span className="policy-tab-btn-text">{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Khung Nội Dung Chính Sách Chi Tiết */}
        <div
          className="policy-content-card"
          role="tabpanel"
          id={activeTab ? `customer-policy-panel-${activeTab}` : "customer-policy-panel-empty"}
          aria-labelledby={activeTab ? `customer-policy-tab-${activeTab}` : undefined}
        >
          <div className="policy-article">
            {loading ? (
              /* Trạng thái tải nội dung Shimmer Skeleton */
              <div className="policy-skeleton-loader" aria-live="polite">
                <div className="policy-skeleton-line title" />
                <div className="policy-skeleton-callout" />
                <div className="policy-skeleton-line" />
                <div className="policy-skeleton-line" />
                <div className="policy-skeleton-line short" />
              </div>
            ) : availableTabs.length === 0 ? (
              /* Trạng thái chưa có chính sách nào được kích hoạt */
              <div className="policy-empty-container">
                <div className="policy-empty-icon" aria-hidden="true">
                  <FileText size={36} />
                </div>
                <h2 className="policy-empty-title">Chính Sách Đang Được Cập Nhật</h2>
                <p className="policy-empty-desc">
                  Hiện các chính sách kinh doanh đang được chuỗi cập nhật để phục vụ quý khách tốt nhất. Quý khách vui lòng liên hệ hotline để được tư vấn trực tiếp.
                </p>
                <a href="tel:1900123456" className="policy-concierge-btn primary">
                  <Phone size={15} />
                  <span>Tư Vấn Hotline 1900 1234</span>
                </a>
              </div>
            ) : activePolicyData ? (
              <>
                <h2 className="policy-article-title">
                  {activePolicyData.title || "Chính Sách Hoạt Động"}
                </h2>

                {/* Hộp Callout Tóm Tắt Nổi Bật Dành Cho Khách Hàng */}
                {activePolicyData.summary ? (
                  <div className="policy-summary-callout">
                    <Sparkles size={20} className="policy-summary-callout-icon" aria-hidden="true" />
                    <div className="policy-summary-callout-text">
                      <strong>Tóm tắt cốt lõi:</strong> {activePolicyData.summary}
                    </div>
                  </div>
                ) : null}

                {/* Nội Dung Điều Khoản Chi Tiết */}
                {activePolicyData.content ? (
                  <div className="policy-article-body">
                    {formattedContent}
                  </div>
                ) : (
                  <div className="policy-empty-content-box">
                    <p>Nội dung chi tiết của điều khoản này đang được hoàn thiện.</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Khối Hỗ Trợ Khách Hàng & Concierge (Customer Care & Concierge) */}
        <section className="policy-concierge-card" aria-label="Hỗ trợ và tư vấn chính sách">
          <div className="policy-concierge-content">
            <div className="policy-concierge-icon-wrapper" aria-hidden="true">
              <Phone size={24} />
            </div>
            <div className="policy-concierge-body">
              <span className="policy-concierge-kicker">DỊCH VỤ KHÁCH HÀNG CAO CẤP</span>
              <h3 className="policy-concierge-title">Bạn Cần Tư Vấn Thêm Về Chính Sách Thuê & Đổi Size?</h3>
              <p className="policy-concierge-desc">
                Đội ngũ Stylist và Bộ phận Chăm sóc Khách hàng VESTORA luôn sẵn sàng hỗ trợ bạn lựa chọn trang phục, tư vấn chính sách cọc và phục vụ tận tâm tại các cửa hàng.
              </p>
            </div>
          </div>
          <div className="policy-concierge-actions">
            <a href="tel:1900123456" className="policy-concierge-btn primary">
              <Phone size={15} />
              <span>Hotline 1900 1234</span>
            </a>
            <a href="mailto:support@vestora.vn" className="policy-concierge-btn secondary">
              <Mail size={15} />
              <span>support@vestora.vn</span>
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
