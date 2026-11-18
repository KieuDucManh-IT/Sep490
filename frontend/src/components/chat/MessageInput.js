import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Loader2 } from 'lucide-react';

export default function MessageInput({
  onSendMessage,
  onTyping,
  disabled = false,
}) {
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Tạo URL preview khi chọn file
  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const handleTextChange = (e) => {
    setContent(e.target.value);

    // Gửi sự kiện typing
    onTyping?.(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTyping?.(false);
    }, 2000);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (selectedFiles.length + files.length > 5) {
      alert('Bạn chỉ có thể chọn tối đa 5 hình ảnh mỗi lần gửi.');
      return;
    }

    const validFiles = [];
    for (const f of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype || f.type)) {
        alert(`File "${f.name}" không đúng định dạng JPG, PNG hoặc WEBP.`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        alert(`File "${f.name}" vượt quá dung lượng tối đa 5MB.`);
        continue;
      }
      validFiles.push(f);
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = content.trim();
    if ((!trimmed && selectedFiles.length === 0) || isSending || disabled) {
      return;
    }

    setIsSending(true);
    onTyping?.(false);

    try {
      await onSendMessage({
        content: trimmed,
        files: selectedFiles,
      });

      setContent('');
      setSelectedFiles([]);
    } catch (err) {
      console.error('Lỗi khi gửi tin:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input-bar-container">
      {/* Xem trước ảnh đã chọn */}
      {previewUrls.length > 0 && (
        <div className="chat-image-preview-bar">
          {previewUrls.map((url, idx) => (
            <div key={url} className="chat-preview-item">
              <img src={url} alt="Xem trước" className="chat-preview-img" />
              <button
                type="button"
                className="chat-preview-remove-btn"
                onClick={() => handleRemoveFile(idx)}
                title="Xóa ảnh"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Form nhập liệu */}
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
        />

        <button
          type="button"
          className="chat-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Đính kèm hình ảnh (tối đa 5 ảnh, 5MB/ảnh)"
          disabled={disabled || isSending}
        >
          <ImageIcon size={20} />
        </button>

        <textarea
          className="chat-text-input"
          placeholder="Nhập nội dung tin nhắn tư vấn... (Enter để gửi)"
          value={content}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled || isSending}
        />

        <button
          type="submit"
          className="chat-send-btn"
          disabled={(!content.trim() && selectedFiles.length === 0) || isSending || disabled}
          title="Gửi tin nhắn"
        >
          {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}

