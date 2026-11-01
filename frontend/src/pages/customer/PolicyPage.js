import React, { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { getPublicPolicies } from "../../services/businessPolicyService";
import {
  Sparkles,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
} from "lucide-react";
import "../../styles/PolicyPage.css";

/**
 * Phân tích nội dung điều khoản văn bản thành tiêu đề con, danh sách và đoạn văn
 */
function renderFormattedContent(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`}>
          {currentList.map((item, idx) => (
            <li key={idx}>{item}</li>
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

    // Tiêu đề mục số: vd "1. Thời Hạn Thuê"
    if (/^\d+\./.test(trimmed)) {
      flushList();
      elements.push(<h3 key={`h3-${idx}`}>{trimmed}</h3>);
    }
    // Gạch đầu dòng: vd "- Nội dung" hoặc "* Nội dung"
    else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
      currentList.push(trimmed.substring(1).trim());
    } else {
      flushList();
      elements.push(<p key={`p-${idx}`}>{trimmed}</p>);
    }
  });

  flushList();
  return elements;
}

export default function PolicyPage() {
  const [policies, setPolicies] = useState(null);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPolicies = async () => {
      try {
        const data = await getPublicPolicies();
        if (data && isMounted) {
          setPolicies(data);
        }
      } catch (_) {
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
    // Tương thích ngược nếu dữ liệu dạng object
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

  // Đặt tab đầu tiên làm mặc định khi tải xong danh sách chính sách
  useEffect(() => {
    if (availableTabs.length > 0 && (!activeTab || !availableTabs.some((t) => t.key === activeTab))) {
      setActiveTab(availableTabs[0].key);
    }
  }, [availableTabs, activeTab]);

  const handleTabChange = useCallback((key) => {
    setActiveTab(key);
  }, []);

  const activePolicyData = useMemo(() => {
    if (!availableTabs.length) return null;
    return availableTabs.find((t) => t.key === activeTab) || availableTabs[0];
  }, [availableTabs, activeTab]);

  return (
    <div className="vestora-page-wrapper">
      <Navbar />

      <main className="policy-main-container">
        {/* Banner tiêu đề Cổng Khách Hàng */}
        <header className="policy-header-section">
          <h1 className="policy-title">Chính Sách Hoạt Động & Cho Thuê</h1>
          <p className="policy-lead">
            Cam kết minh bạch và bảo vệ tối đa quyền lợi khách hàng trong suốt quá trình thuê, đổi size, hoàn trả và bảo hiểm trang phục tại toàn bộ chuỗi cửa hàng VESTORA.
          </p>
        </header>

        {/* Tab Switcher - Các Danh Mục Chính Sách Động từ Database */}
        <div
          className="policy-tab-bar"
          role="tablist"
          aria-label="Danh mục các chính sách hoạt động"
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
                onKeyDown={(e) => {
                  let nextIdx = null;
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    nextIdx = (idx + 1) % availableTabs.length;
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    nextIdx = (idx - 1 + availableTabs.length) % availableTabs.length;
                  }
                  if (nextIdx !== null) {
                    const nextKey = availableTabs[nextIdx].key;
                    handleTabChange(nextKey);
                    const el = document.getElementById(`customer-policy-tab-${nextKey}`);
                    if (el) el.focus();
                  }
                }}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Khung Nội Dung Chính Sách Chi Tiết */}
        <div
          className="policy-content-card"
          role="tabpanel"
          id={`customer-policy-panel-${activeTab}`}
          aria-labelledby={`customer-policy-tab-${activeTab}`}
        >
          <div className="policy-article">
            {loading ? (
              <div className="policy-skeleton-loader" aria-live="polite">
                <div className="policy-skeleton-line title" />
                <div className="policy-skeleton-callout" />
                <div className="policy-skeleton-line" />
                <div className="policy-skeleton-line" />
                <div className="policy-skeleton-line short" />
              </div>
            ) : activePolicyData ? (
              <>
                {/* Thanh thông tin quy chuẩn đọc cho khách hàng */}
                <div className="policy-meta-strip">
                  <div className="policy-meta-pill">
                    <CheckCircle2 size={13} className="text-emerald" />
                    <span>Hiệu lực: Toàn bộ chuỗi cửa hàng VESTORA</span>
                  </div>
                  <div className="policy-meta-pill">
                    <Clock size={13} />
                    <span>Thời gian đọc: ~2 phút</span>
                  </div>
                </div>

                <h2 className="policy-article-title">{activePolicyData.title || "Chính Sách Hoạt Động"}</h2>

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
                {renderFormattedContent(activePolicyData.content)}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#888888" }}>
                <p>Chính sách này hiện đang được cập nhật.</p>
              </div>
            )}
          </div>
        </div>

        {/* Khối Hỗ Trợ Khách Hàng & Concierge (Customer Care & Concierge) */}
        <section className="policy-concierge-card" aria-label="Hỗ trợ và tư vấn chính sách">
          <div className="policy-concierge-content">
            <div className="policy-concierge-icon-wrapper">
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
