import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Sparkles,
  Maximize2,
  X,
  Loader2,
  RotateCw,
  Send,
  PartyPopper,
  Flower2,
  Coins,
} from 'lucide-react';
import apiClient from '../services/api';
import '../styles/AiStylistWidget.css';

const currency = new Intl.NumberFormat('vi-VN');

const INITIAL_MSG = {
  role: 'model',
  text: 'Xin chào! Mình là AI Stylist của VESTORA. Bạn cần tư vấn chọn trang phục cho sự kiện nào không?',
};

export default function AiStylistWidget() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MSG]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Không hiển thị widget nổi nếu đang ở chính trang /stylist hoặc các trang quản trị (owner, admin, warehouse, branch)
  const isExcludedPath =
    location.pathname.startsWith('/stylist') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/owner') ||
    location.pathname.startsWith('/branch') ||
    location.pathname.startsWith('/warehouse');

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isOpen, sending]);

  if (isExcludedPath) {
    return null;
  }

  const handleSend = async (customText) => {
    const text = (customText || draft).trim();
    if (!text || sending) return;

    setDraft('');
    setSending(true);

    const history = messages
      .filter((m) => !m.pending && m.text)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [
      ...prev,
      { role: 'user', text },
      { role: 'model', text: 'Đang tìm trang phục phù hợp cho bạn…', pending: true },
    ]);

    try {
      const res = await apiClient.post('/chat', { message: text, history }, { timeout: 60000 });
      if (res && res.success) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: 'model',
            text: res.reply || 'Dưới đây là một số gợi ý cho bạn:',
            products: Array.isArray(res.products) ? res.products : [],
          },
        ]);
      } else {
        throw new Error(res?.error || 'Lỗi kết nối');
      }
    } catch (err) {
      console.error('Lỗi khi gửi tin nhắn cho AI Stylist:', err);
      const errMsg =
        err?.data?.error ||
        err?.response?.data?.error ||
        err?.message ||
        'Stylist tạm thời gián đoạn kết nối.';
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: 'model',
          text: `Rất tiếc, Stylist gặp sự cố (${errMsg}). Bạn có thể bấm nút "Thử lại" bên dưới nhé!`,
          isError: true,
          failedText: text,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Nút launcher nổi */}
      {!isOpen && (
        <button
          type="button"
          className="stylist-widget-launcher"
          onClick={() => setIsOpen(true)}
          aria-label="Mở tư vấn AI Stylist"
        >
          <span className="stylist-launcher-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="#C5A880" />
          </span>
          <span className="stylist-launcher-text">
            <span className="stylist-launcher-title">AI Stylist</span>
            <span className="stylist-launcher-sub">Tư vấn trang phục</span>
          </span>
        </button>
      )}

      {/* Cửa sổ chat mini popup */}
      {isOpen && (
        <div className="stylist-widget-popup" role="dialog" aria-modal="true">
          {/* Header */}
          <div className="stylist-widget-header">
            <div className="stylist-widget-brand">
              <span className="stylist-widget-avatar">V</span>
              <div>
                <strong>VESTORA Stylist AI</strong>
                <span>Tư vấn trực tuyến</span>
              </div>
            </div>
            <div className="stylist-widget-controls">
              <Link
                to="/stylist"
                className="stylist-widget-btn"
                title="Mở toàn màn hình Studio"
                onClick={() => setIsOpen(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Maximize2 size={14} />
              </Link>
              <button
                type="button"
                className="stylist-widget-btn"
                onClick={() => setIsOpen(false)}
                title="Đóng chat"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="stylist-widget-messages">
            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <div key={i} className={`stylist-wmsg ${isUser ? 'from-user' : 'from-stylist'}`}>
                  {!isUser && <span className="stylist-wmsg-avatar">V</span>}
                  <div className="stylist-wmsg-body">
                    <div className={`stylist-wbubble ${isUser ? 'user' : 'stylist'} ${m.isError ? 'error-bubble' : ''}`}>
                      {m.pending ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Loader2 size={13} className="spin" /> Đang duyệt đồ...
                        </span>
                      ) : (
                        m.text
                      )}
                      {m.isError && m.failedText && (
                        <div style={{ marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleSend(m.failedText)}
                            style={{
                              background: '#435339',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '14px',
                              padding: '5px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <RotateCw size={12} /> Thử lại câu này
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Gợi ý sản phẩm dạng thẻ nhỏ */}
                    {!m.pending && m.products && m.products.length > 0 && (
                      <div className="stylist-wrec-list">
                        {m.products.map((p) => (
                          <Link
                            key={p.id}
                            to={`/product/${p.id}`}
                            className="stylist-wrec-card"
                            onClick={() => setIsOpen(false)}
                          >
                            <div className="stylist-wrec-thumb">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} loading="lazy" />
                              ) : (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                  <Sparkles size={14} color="#C5A880" />
                                </span>
                              )}
                            </div>
                            <div className="stylist-wrec-details">
                              <h6 className="stylist-wrec-title">{p.name}</h6>
                              <span className="stylist-wrec-cat">{p.category}</span>
                              <span className="stylist-wrec-price">
                                {currency.format(p.rentalPricePerDayVnd || p.rentalPricePerDay || 0)}đ/ngày
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Gợi ý câu hỏi nhanh */}
          <div className="stylist-wquick-prompts">
            <button
              type="button"
              disabled={sending}
              onClick={() => handleSend('Gợi ý trang phục đi tiệc cưới')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <PartyPopper size={13} color="#C5A880" /> Tiệc cưới
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => handleSend('Áo dài truyền thống thanh lịch')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Flower2 size={13} color="#C5A880" /> Áo dài
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => handleSend('Trang phục giá thuê dưới 300k')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Coins size={13} color="#C5A880" /> Dưới 300k
            </button>
          </div>

          {/* Composer */}
          <div className="stylist-wcomposer">
            <form
              className="stylist-wcomposer-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                type="text"
                className="stylist-wcomposer-input"
                placeholder="Nhắn tin cho Stylist..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending}
                maxLength={500}
              />
              <button
                type="submit"
                className="stylist-wsend-btn"
                disabled={sending || !draft.trim()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

