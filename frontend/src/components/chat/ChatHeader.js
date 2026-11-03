import React from 'react';
import { ArrowLeft, Store, Phone } from 'lucide-react';

export default function ChatHeader({
  conversation,
  isCustomerView,
  isPartnerOnline,
  onBack,
}) {
  if (!conversation) return null;

  const shop = conversation.shopId;
  const customer = conversation.customerId;

  const title = isCustomerView
    ? shop?.name || 'Cửa Hàng VESTORA'
    : customer?.FullName || 'Khách hàng';

  const avatarUrl = isCustomerView
    ? shop?.imageUrl || ''
    : customer?.Avatar || '';

  const initial = title ? title.trim().charAt(0).toUpperCase() : 'V';

  return (
    <div className="chat-header">
      <div className="chat-header-left">
        {onBack && (
          <button
            type="button"
            className="chat-back-btn"
            onClick={onBack}
            title="Quay lại danh sách"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="chat-avatar-wrapper">
          {avatarUrl ? (
            <img src={avatarUrl} alt={title} className="chat-avatar-img" />
          ) : (
            <div className="chat-avatar-fallback">{initial}</div>
          )}
          <span
            className={`chat-status-dot ${isPartnerOnline ? 'online' : ''}`}
            title={isPartnerOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
          />
        </div>

        <div>
          <h3 className="chat-header-title">{title}</h3>
          <div className="chat-header-sub">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: isPartnerOnline ? '#10b981' : '#94a3b8',
                display: 'inline-block',
              }}
            />
            <span>{isPartnerOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}</span>

            {isCustomerView && shop?.address && (
              <>
                <span>•</span>
                <span title={shop.address} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Store size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                  {shop.address}
                </span>
              </>
            )}

            {isCustomerView && shop?.phone && (
              <>
                <span>•</span>
                <span>
                  <Phone size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                  {shop.phone}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="chat-header-actions">
        {conversation.productContexts?.length > 0 && (
          <span
            className="badge rounded-pill bg-light text-dark border px-3 py-2"
            style={{ fontSize: '12px' }}
          >
            Đang quan tâm {conversation.productContexts.length} sản phẩm
          </span>
        )}
      </div>
    </div>
  );
}

