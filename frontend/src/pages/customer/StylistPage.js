import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Gem,
  History,
  RotateCw,
  AlertCircle,
  Loader2,
  ArrowUp,
  Search,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import apiClient from '../../services/api';
import productService from '../../services/productService';
import '../../styles/StylistPage.css';

const currency = new Intl.NumberFormat('vi-VN');

const INITIAL_MESSAGE = {
  role: 'model',
  text: 'Chào bạn! Mình là Stylist AI của VESTORA   . Bạn đang chuẩn bị cho sự kiện hay dịp đặc biệt nào? Hãy chia sẻ về phong cách yêu thích, vóc dáng, màu sắc hoặc mức ngân sách bạn mong muốn, mình sẽ chọn và phối cho bạn những bộ trang phục hoàn hảo nhất từ tủ đồ VESTORA nhé!',
  timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
};

const QUICK_PROMPTS = [
  'Áo dài dự tiệc cưới thanh lịch',
  'Đầm dạ hội sang trọng màu đỏ/đen',
  'Trang phục thuê dưới 300.000đ/ngày',
  'Set vest lịch lãm đi sự kiện',
  'Trang phục dạo phố cuối tuần',
];

export default function StylistPage() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Catalog bên phải
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const chatEndRef = useRef(null);

  // Tải danh sách sản phẩm thực tế từ Database dự án
  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        setLoadingCatalog(true);
        const res = await productService.getProducts({ limit: 40 });
        if (isMounted) {
          const items = Array.isArray(res?.data) ? res.data : [];
          setCatalogProducts(items);
        }
      } catch (err) {
        console.error('Không tải được catalog:', err);
      } finally {
        if (isMounted) setLoadingCatalog(false);
      }
    };
    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  // Danh sách các danh mục sản phẩm từ catalog
  const categories = useMemo(() => {
    const list = new Set();
    catalogProducts.forEach((p) => {
      if (p.category) {
        if (Array.isArray(p.category)) p.category.forEach((c) => list.add(c));
        else list.add(p.category);
      }
      if (p.categoryId?.name) list.add(p.categoryId.name);
    });
    return ['All', ...Array.from(list)];
  }, [catalogProducts]);

  // Bộ lọc sản phẩm bên cột Catalog
  const visibleCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return catalogProducts.filter((item) => {
      const matchCat =
        selectedCategory === 'All' ||
        (Array.isArray(item.category)
          ? item.category.includes(selectedCategory)
          : item.category === selectedCategory || item.categoryId?.name === selectedCategory);

      const name = (item.name || '').toLowerCase();
      const code = (item.productCode || item.sku || '').toLowerCase();
      const brand = (item.brand || '').toLowerCase();
      const matchQuery = !q || name.includes(q) || code.includes(q) || brand.includes(q);

      return matchCat && matchQuery;
    });
  }, [catalogProducts, selectedCategory, catalogSearch]);

  // Gửi tin nhắn đến AI Gemini Stylist
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || draft).trim();
    if (!text || sending) return;

    setDraft('');
    setChatError('');
    setSending(true);

    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // Thu thập lịch sử hội thoại gần nhất (tối đa 8 lượt)
    const history = messages
      .filter((m) => !m.pending && m.text)
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));

    // Cập nhật tin nhắn người dùng + bubble loading của AI
    setMessages((prev) => [
      ...prev,
      { role: 'user', text, timestamp: now },
      {
        role: 'model',
        text: 'Stylist đang rà soát tủ đồ VESTORA để chọn những mẫu phù hợp nhất cho bạn…',
        pending: true,
      },
    ]);

    try {
      const res = await apiClient.post('/chat', { message: text, history }, { timeout: 60000 });

      if (res && res.success) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: 'model',
            text: res.reply || 'Dưới đây là một số gợi ý trang phục phù hợp với nhu cầu của bạn:',
            products: Array.isArray(res.products) ? res.products : [],
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        throw new Error(res?.error || 'Không nhận được câu trả lời từ Stylist.');
      }
    } catch (err) {
      console.error('Lỗi khi chat với stylist:', err);
      const errMsg = err.response?.data?.error || err.message || 'Chưa thể kết nối với Stylist AI lúc này.';
      setChatError(errMsg);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'model',
          text: `Rất xin lỗi bạn, Stylist tạm thời gặp sự cố kết nối: "${errMsg}". Bạn vui lòng gửi lại nhé!`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = () => {
    setShowClearModal(true);
  };

  const handleConfirmClear = () => {
    setMessages([INITIAL_MESSAGE]);
    setChatError('');
    setShowClearModal(false);
    showToast('Đã làm mới cuộc hội thoại với Stylist');
  };

  return (
    <div className="stylist-page-root">
      <Navbar />

      <main className="stylist-container">
        {/* HERO BANNER */}
        <section className="stylist-hero">
          <div className="stylist-hero-content">
            <span className="stylist-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} color="#C5A880" /> VESTORA INTELLIGENT STYLIST
            </span>
            <h1 className="stylist-hero-title">
              Trợ Lý Thời Trang AI <br />
              <em>Định hình phong cách của bạn.</em>
            </h1>
            <p className="stylist-hero-desc">
              Được hỗ trợ bởi Google Gemini AI và kết nối trực tiếp với tủ đồ thực tế của VESTORA.
              Hãy cho stylist biết dịp bạn tham gia, ngân sách, hoặc kiểu dáng mong muốn để nhận gợi ý phối đồ chuẩn xác.
            </p>
            <div className="stylist-hero-badges">
              <span className="stylist-badge-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="#C5A880" /> Phân tích ngữ cảnh sự kiện
              </span>
              <span className="stylist-badge-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Gem size={14} color="#C5A880" /> Sản phẩm thật từ tủ đồ
              </span>
              <span className="stylist-badge-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <History size={14} color="#C5A880" /> Tư vấn tức thì 24/7
              </span>
            </div>
          </div>

          <div className="stylist-hero-art">
            <div className="stylist-art-orbit">
              <div className="stylist-art-card">
                <div className="stylist-art-avatar">V</div>
                <div>
                  <div className="stylist-art-title">AI Fashion Stylist</div>
                  <div className="stylist-art-tag">VESTORA Studio</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WORKSPACE */}
        <section className="stylist-workspace">
          {/* CHAT PANEL */}
          <div className="stylist-chat-card">
            {/* Header */}
            <div className="stylist-chat-header">
              <div className="stylist-header-profile">
                <div className="stylist-avatar-bubble">V</div>
                <div className="stylist-profile-info">
                  <strong>VESTORA Stylist AI</strong>
                  <span className="stylist-status-indicator">
                    <span className="online-dot"></span> Đang trực tuyến · Sẵn sàng tư vấn
                  </span>
                </div>
              </div>
              <div className="stylist-chat-actions">
                <button
                  type="button"
                  className="stylist-btn-clear"
                  onClick={handleClearHistory}
                  title="Làm mới hội thoại"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RotateCw size={13} /> Làm mới
                </button>
              </div>
            </div>

            {/* Message List */}
            <div className="stylist-chat-messages">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={`${idx}-${msg.role}`}
                    className={`stylist-msg-row ${isUser ? 'from-user' : 'from-stylist'}`}
                  >
                    {!isUser && <div className="stylist-msg-avatar">V</div>}
                    <div className="stylist-msg-body">
                      <div className={`stylist-bubble ${isUser ? 'user-speech' : 'stylist-speech'}`}>
                        {msg.pending ? (
                          <div className="stylist-typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>

                      {/* Gợi ý sản phẩm kèm theo */}
                      {!msg.pending && msg.products && msg.products.length > 0 && (
                        <div className="stylist-recommendations-box">
                          <span className="stylist-rec-header" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Sparkles size={14} color="#C5A880" /> Gợi ý trang phục cho bạn
                          </span>
                          {msg.products.map((prod) => (
                            <Link
                              key={prod.id}
                              to={`/product/${prod.id}`}
                              className="stylist-rec-card"
                            >
                              <div className="stylist-rec-img-wrap">
                                {prod.imageUrl ? (
                                  <img src={prod.imageUrl} alt={prod.name} loading="lazy" />
                                ) : (
                                  <span className="stylist-rec-img-fallback">V</span>
                                )}
                              </div>
                              <div className="stylist-rec-content">
                                <div>
                                  <h4 className="stylist-rec-name">{prod.name}</h4>
                                  <div className="stylist-rec-cat">
                                    {prod.category} · {prod.code || prod.sku}
                                  </div>
                                </div>
                                <div className="stylist-rec-price-row">
                                  <span className="stylist-rec-rent-price">
                                    {currency.format(prod.rentalPricePerDayVnd || prod.rentalPricePerDay || 0)}đ{' '}
                                    <small>/ ngày</small>
                                  </span>
                                  {prod.depositVnd > 0 && (
                                    <span className="stylist-rec-deposit">
                                      Cọc {currency.format(prod.depositVnd)}đ
                                    </span>
                                  )}
                                </div>
                                <div className="stylist-rec-tags">
                                  {prod.sizes && prod.sizes.length > 0 && (
                                    <span className="stylist-tag-micro">
                                      Size: {prod.sizes.join(', ')}
                                    </span>
                                  )}
                                  {prod.colors && prod.colors.length > 0 && (
                                    <span className="stylist-tag-micro">
                                      {prod.colors.slice(0, 2).join(' · ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}

                      {msg.timestamp && (
                        <span className="stylist-msg-time">{msg.timestamp}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts */}
            <div className="stylist-quick-prompts">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  className="stylist-quick-btn"
                  disabled={sending}
                  onClick={() => handleSendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Composer */}
            <div className="stylist-composer-wrapper">
              {chatError && (
                <div style={{ color: '#dc2626', fontSize: 11.5, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {chatError}
                </div>
              )}
              <form
                className="stylist-composer-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <input
                  type="text"
                  className="stylist-composer-input"
                  placeholder="Hỏi stylist: 'Tôi cần bộ đầm dự tiệc cưới cuối tuần...', 'Tìm áo dài màu đỏ'..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={sending}
                  maxLength={1500}
                />
                <button
                  type="submit"
                  className="stylist-send-btn"
                  disabled={sending || !draft.trim()}
                  title="Gửi câu hỏi"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {sending ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <ArrowUp size={16} />
                  )}
                </button>
              </form>
              <p className="stylist-composer-footnote">
                Stylist AI đề xuất trang phục thực tế từ cơ sở dữ liệu VESTORA dựa theo yêu cầu của bạn.
              </p>
            </div>
          </div>

          {/* SIDE CATALOG PREVIEW */}
          <aside className="stylist-side-catalog">
            <div className="stylist-catalog-heading">
              <h3>Tủ Đồ VESTORA</h3>
              <span className="stylist-catalog-count">
                {visibleCatalog.length} SẢN PHẨM
              </span>
            </div>

            <div className="stylist-catalog-toolbar">
              <div className="stylist-search-box" style={{ display: 'flex', alignItems: 'center' }}>
                <Search size={14} color="#A1A1AA" style={{ marginLeft: 10, flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Tìm nhanh sản phẩm..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
              </div>

              <div className="stylist-cat-chips">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`stylist-cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === 'All' ? 'Tất cả' : cat}
                  </button>
                ))}
              </div>
            </div>

            {loadingCatalog ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
                <Loader2 size={28} color="#C5A880" className="spin" style={{ margin: '0 auto' }} />
                <p style={{ marginTop: 10, fontSize: 13 }}>Đang tải catalog VESTORA...</p>
              </div>
            ) : visibleCatalog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 13 }}>
                Không tìm thấy sản phẩm nào phù hợp.
              </div>
            ) : (
              <div className="stylist-catalog-scroll">
                {visibleCatalog.map((prod) => (
                  <Link
                    key={prod._id || prod.id}
                    to={`/product/${prod._id || prod.id}`}
                    className="stylist-mini-card"
                  >
                    <div className="stylist-mini-thumb">
                      {prod.image || prod.imageUrl || prod.images?.[0]?.imageUrl ? (
                        <img
                          src={prod.image || prod.imageUrl || prod.images?.[0]?.imageUrl}
                          alt={prod.name}
                          loading="lazy"
                        />
                      ) : (
                        <span className="stylist-mini-placeholder">V</span>
                      )}
                    </div>
                    <div className="stylist-mini-info">
                      <h5 className="stylist-mini-title">{prod.name}</h5>
                      <div className="stylist-mini-price">
                        {currency.format(prod.rentalPricePerDay || prod.rentalPricePer3Days / 3 || 0)}đ{' '}
                        <small>/ ngày</small>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </section>
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            zIndex: 99999,
            background: '#171717',
            color: '#F8F7F4',
            border: '1px solid #C5A880',
            borderRadius: 10,
            padding: '12px 20px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}
        >
          <CheckCircle2 size={16} color="#C5A880" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {showClearModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(23, 23, 23, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowClearModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 420,
              width: '100%',
              padding: '28px 24px',
              border: '1px solid #E5E0D8',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#FEF3C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Trash2 size={24} color="#D97706" />
            </div>
            <h3
              style={{
                fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                fontSize: 20,
                color: '#171717',
                marginBottom: 8,
              }}
            >
              Làm Mới Lịch Sử Trò Chuyện?
            </h3>
            <p style={{ fontSize: 13.5, color: '#71717A', lineHeight: 1.5, marginBottom: 24 }}>
              Toàn bộ các đề xuất phối đồ và tin nhắn hiện tại sẽ được khởi tạo lại từ đầu cùng AI Stylist.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 8,
                  border: '1px solid #E5E0D8',
                  background: '#F8F7F4',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#171717',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#C5A880',
                  color: '#FFFFFF',
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}