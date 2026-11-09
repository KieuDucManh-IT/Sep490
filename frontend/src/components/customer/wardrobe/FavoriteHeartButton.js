/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-003
 *
 * FavoriteHeartButton — Nút Thả tim / Bỏ tim 1-click phản hồi tức thì chuẩn Haute Couture
 * - Tương tác siêu mượt (Optimistic Update)
 * - Zero-Emoji (Sử dụng Lucide React SVG icon)
 * - Hiệu ứng nảy nhẹ tinh tế (Pop animation)
 */

import React, { useState, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { useWishlistStore } from '../../../stores/useWishlistStore';
import './WardrobeModals.css';

export const FavoriteHeartButton = ({
  productId,
  product,
  size = 'md',
  className = '',
  onToggle,
  showCount = false,
  disabled = false,
}) => {
  const actualId = productId || (product?._id || product?.id);
  const isWishlisted = useWishlistStore((state) => state.isWishlisted(actualId));
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const [isAnimating, setIsAnimating] = useState(false);

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  const handleClick = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled || !actualId) return;

      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 350);

      try {
        const itemToPass = product || actualId;
        const nextState = await toggleWishlist(itemToPass);
        if (onToggle) {
          onToggle(nextState);
        }
      } catch (err) {
        console.error('Lỗi khi thao tác thả tim:', err);
      }
    },
    [actualId, disabled, onToggle, product, toggleWishlist]
  );

  return (
    <button
      type="button"
      className={`vst-heart-btn vst-heart-btn--${size} ${isWishlisted ? 'vst-heart-btn--active' : ''} ${
        isAnimating ? 'vst-heart-btn--animating' : ''
      } ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={isWishlisted ? 'Bỏ yêu thích sản phẩm' : 'Thêm sản phẩm vào yêu thích'}
      title={isWishlisted ? 'Bỏ yêu thích' : 'Yêu thích'}
    >
      <Heart
        size={iconSizes[size] || 20}
        fill={isWishlisted ? '#C5A880' : 'none'}
        stroke={isWishlisted ? '#C5A880' : 'currentColor'}
        strokeWidth={1.8}
      />
    </button>
  );
};

export default FavoriteHeartButton;
