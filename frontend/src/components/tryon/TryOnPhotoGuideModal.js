import React from 'react';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';

export default function TryOnPhotoGuideModal({ isOpen, onClose, onUploadClick }) {
  if (!isOpen) return null;

  return (
    <div className="tryon-modal-backdrop" onClick={onClose}>
      <div className="tryon-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="tryon-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="tryon-modal-icon-wrap">
              <Sparkles size={18} color="#5b6e4e" />
            </div>
            <div>
              <h3 className="tryon-modal-title">
                Mẹo chọn ảnh chuẩn để AI ghép đẹp nhất
              </h3>
              <p className="tryon-modal-subtitle">
                Công nghệ AI IDM-VTON cần nhận diện rõ phom dáng người để tạo nếp vải ôm sát tự nhiên
              </p>
            </div>
          </div>
          <button
            type="button"
            className="tryon-modal-close-btn"
            onClick={onClose}
            title="Đóng bảng hướng dẫn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: 2 Cột So Sánh Trực Quan */}
        <div className="tryon-guide-columns">
          {/* Cột 1: NÊN DÙNG (DO) */}
          <div className="tryon-guide-col guide-col-do">
            <div className="guide-col-header header-do">
              <CheckCircle2 size={16} />
              <span>ẢNH NÊN DÙNG (KẾT QUẢ ĐẸP 98%)</span>
            </div>
            <div className="guide-visual-card visual-do">
              <div className="guide-visual-badge badge-do">✓ Chuẩn phom</div>
              <div className="guide-stickman stickman-do">
                <svg viewBox="0 0 100 130" width="70" height="90">
                  <circle cx="50" cy="18" r="9" fill="#5b6e4e" />
                  <line x1="50" y1="28" x2="50" y2="75" stroke="#5b6e4e" strokeWidth="5.5" strokeLinecap="round" />
                  <line x1="50" y1="38" x2="26" y2="70" stroke="#5b6e4e" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="50" y1="38" x2="74" y2="70" stroke="#5b6e4e" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="50" y1="75" x2="36" y2="120" stroke="#5b6e4e" strokeWidth="5" strokeLinecap="round" />
                  <line x1="50" y1="75" x2="64" y2="120" stroke="#5b6e4e" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="guide-visual-desc">Đứng thẳng trực diện, 2 tay buông nhẹ</span>
            </div>
            <ul className="guide-points-list">
              <li><strong>Đứng thẳng trực diện:</strong> Hai vai cân đối, nhìn thẳng camera, chụp toàn thân hoặc 3/4 người.</li>
              <li><strong>Hai tay để thoáng:</strong> Buông tự nhiên hoặc chống nhẹ eo, không bắt chéo qua ngực hay đùi.</li>
              <li><strong>Lộ rõ phom trang phục:</strong> Mặc đồ ôm vừa vặn (áo thun, quần jean/ôm) giúp AI nhận diện chuẩn.</li>
              <li><strong>Ánh sáng & Phông nền:</strong> Đủ sáng tự nhiên, nền tường trơn đơn giản, không bị ngược sáng.</li>
            </ul>
          </div>

          {/* Cột 2: KHÔNG NÊN DÙNG (DON'T) */}
          <div className="tryon-guide-col guide-col-dont">
            <div className="guide-col-header header-dont">
              <X size={16} />
              <span>ẢNH DỄ BỊ LỖI KHI GHÉP</span>
            </div>
            <div className="guide-visual-card visual-dont">
              <div className="guide-visual-badge badge-dont">✕ Dễ bị méo/lem</div>
              <div className="guide-stickman stickman-dont">
                <svg viewBox="0 0 100 130" width="70" height="90">
                  <circle cx="50" cy="18" r="9" fill="#dc2626" />
                  <line x1="50" y1="28" x2="50" y2="75" stroke="#dc2626" strokeWidth="5.5" strokeLinecap="round" />
                  {/* Tay giơ lên trán */}
                  <line x1="50" y1="38" x2="32" y2="20" stroke="#dc2626" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1="32" y1="20" x2="45" y2="14" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
                  {/* Vật cản che hông (ván trượt, túi xách) */}
                  <rect x="22" y="60" width="56" height="22" rx="6" fill="#b91c1c" opacity="0.85" />
                  <text x="50" y="74" fontSize="7.5" fill="#ffffff" textAnchor="middle" fontWeight="bold">VẬT CẢN (VÁN/TÚI)</text>
                  <line x1="50" y1="75" x2="38" y2="120" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
                  <line x1="50" y1="75" x2="62" y2="120" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="guide-visual-desc">Cầm vật cản che hông, tay chạm đầu/trán</span>
            </div>
            <ul className="guide-points-list">
              <li><strong>Có vật cản che người:</strong> Cầm ván trượt, túi to, gấu bông, điện thoại che gương (làm váy bị cắt đôi).</li>
              <li><strong>Tay giơ lên trán/tóc:</strong> Tay vắt chéo che ngực hoặc chạm tóc (làm lem màu áo mới lên tóc và nền).</li>
              <li><strong>Tư thế vặn người/nghiêng:</strong> Đứng xoay góc quá lớn hoặc cúi người làm lệch đường may của áo.</li>
              <li><strong>Nền quá rối rắm/ngược sáng:</strong> Chụp trong bóng tối hoặc có nhiều người đứng lẫn phía sau.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="tryon-modal-footer">
          <div className="tryon-modal-tip">
            💡 <strong>Mẹo tiết kiệm thời gian:</strong> Nếu chưa có ảnh cá nhân phù hợp, bạn có thể chọn sẵn một trong các người mẫu chuẩn ở Bước 1 để AI ướm thử ngay lập tức!
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-modal-upload-now"
              onClick={() => {
                onClose();
                onUploadClick?.();
              }}
            >
              Tải ảnh toàn thân của bạn ngay &rarr;
            </button>
            <button
              type="button"
              className="btn-modal-dismiss"
              onClick={onClose}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
