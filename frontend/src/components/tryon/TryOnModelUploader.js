import React from 'react';
import { Sparkles } from 'lucide-react';

export default function TryOnModelUploader({
  userUploadedFile,
  activeModelImage,
  fileInputRef,
  onFileChange,
  onResetUserPhoto,
  onOpenGuideModal,
}) {
  return (
    <div className="panel-dark-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--color-gold, #5b6e4e)' }}>
          BƯỚC 1
        </span>
        <span
          style={{
            fontSize: '10px',
            background: userUploadedFile ? '#eaf2e6' : '#eff2eb',
            color: userUploadedFile ? '#5b6e4e' : '#4a5246',
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 600,
          }}
        >
          {userUploadedFile ? 'Ảnh của bạn' : 'Mẫu chuẩn'}
        </span>
      </div>

      <h2 style={{ fontFamily: 'var(--font-title, sans-serif)', fontSize: '14px', fontWeight: 700, margin: 0, color: '#1f2421' }}>
        1. Ảnh Người Thử / Cá Nhân
      </h2>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
      />

      <div
        className={`dropzone-box ${userUploadedFile ? 'has-file' : ''}`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '2px', color: '#1f2421' }}>
          {userUploadedFile ? 'Đã tải ảnh cá nhân thành công' : 'Bấm để tải ảnh toàn thân của bạn'}
        </div>
        <div style={{ fontSize: '10px', color: '#6e7569', marginBottom: '8px' }}>
          {userUploadedFile
            ? `${userUploadedFile.name} (${(userUploadedFile.size / 1024 / 1024).toFixed(1)}MB)`
            : 'Hỗ trợ ảnh JPG, PNG chụp rõ toàn thân, phông trơn'}
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ height: '28px', padding: '0 12px', fontSize: '10px', pointerEvents: 'none' }}
        >
          {userUploadedFile ? 'Chọn ảnh khác' : 'Tải ảnh toàn thân'}
        </button>
      </div>

      {/* Active model card */}
      <div
        style={{
          background: '#f4f6f1',
          borderRadius: '8px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid var(--color-border, #e2e6dc)',
        }}
      >
        <img
          src={activeModelImage}
          alt="Model"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1.5px solid var(--color-gold, #5b6e4e)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1f2421', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {userUploadedFile ? 'Ảnh cá nhân của bạn' : 'Ảnh người mẫu mặc định'}
          </div>
          <div style={{ fontSize: '10px', color: userUploadedFile ? '#5b6e4e' : '#6e7569', marginTop: '1px', fontWeight: 500 }}>
            {userUploadedFile ? '✓ Đã sẵn sàng thử đồ' : 'Chưa tải ảnh — Dùng mẫu'}
          </div>
        </div>
        {userUploadedFile && (
          <button
            type="button"
            onClick={onResetUserPhoto}
            style={{
              height: '24px',
              padding: '0 8px',
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#DC2626',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
            title="Huỷ ảnh cá nhân"
          >
            Huỷ
          </button>
        )}
      </div>

      {/* Nút mở Popup Hướng dẫn ảnh chuẩn */}
      <div
        style={{
          background: '#f4f6f1',
          padding: '8px 10px',
          borderRadius: '8px',
          border: '1px solid var(--color-border, #e2e6dc)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#1f2421', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={11} color="var(--color-gold, #5b6e4e)" /> Mẹo ảnh chuẩn
          </span>
          <button
            type="button"
            onClick={onOpenGuideModal}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-gold, #5b6e4e)',
              fontSize: '9.5px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Chi tiết &rarr;
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenGuideModal}
          className="btn-photo-guide-pill"
          title="Xem ảnh ví dụ trực quan NÊN vs KHÔNG NÊN"
        >
          <span>Xem mẹo chọn ảnh chuẩn để AI ghép đẹp nhất</span>
          <span className="guide-pill-badge">Nên xem</span>
        </button>
      </div>
    </div>
  );
}
