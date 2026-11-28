import React, { useState, useEffect, useMemo } from 'react';
import { Star, X, Loader2, CheckCircle, Package } from 'lucide-react';
import { submitReview, submitBatchReviews } from '../../services/reviewApi';
import '../../styles/ProductReviewModal.css';

const RATING_DESCRIPTIONS = {
  1: 'Rất tệ',
  2: 'Chưa hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Tuyệt vời',
};

export default function ProductReviewModal({
  isOpen,
  onClose,
  order,
  orderType = 'rental',
  initialProduct = null,
  allProducts = [],
  onSuccess,
}) {
  // If multiple products are passed, allow switching or reviewing all
  const productsToReview = useMemo(() => {
    return allProducts.length > 0
      ? allProducts
      : (initialProduct ? [initialProduct] : []);
  }, [allProducts, initialProduct]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  // Store form state per product: { [productId]: { rating: 5, comment: '' } }
  const [reviewsData, setReviewsData] = useState({});
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Initialize reviewsData whenever productsToReview change
  useEffect(() => {
    if (productsToReview.length > 0) {
      const initial = {};
      productsToReview.forEach((prod) => {
        const id = prod._id || prod.productId?._id || prod.productId;
        initial[id] = {
          rating: 5,
          comment: '',
        };
      });
      setReviewsData(initial);

      // If initialProduct is provided, select it
      if (initialProduct) {
        const targetId = initialProduct._id || initialProduct.productId?._id || initialProduct.productId;
        const idx = productsToReview.findIndex((p) => {
          const pid = p._id || p.productId?._id || p.productId;
          return pid === targetId;
        });
        if (idx !== -1) setSelectedIndex(idx);
      } else {
        setSelectedIndex(0);
      }
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [isOpen, initialProduct, productsToReview]);

  if (!isOpen || productsToReview.length === 0) return null;

  const currentProduct = productsToReview[selectedIndex];
  const currentProdId = currentProduct?._id || currentProduct?.productId?._id || currentProduct?.productId;
  const currentProdData = reviewsData[currentProdId] || { rating: 5, comment: '' };

  const handleRatingChange = (score) => {
    setReviewsData((prev) => ({
      ...prev,
      [currentProdId]: {
        ...prev[currentProdId],
        rating: score,
      },
    }));
  };

  const handleCommentChange = (text) => {
    setReviewsData((prev) => ({
      ...prev,
      [currentProdId]: {
        ...prev[currentProdId],
        comment: text,
      },
    }));
  };

  const getProductImage = (prod) => {
    const raw = prod.productId || prod;
    return raw?.thumbnail || raw?.images?.[0] || raw?.image || '/placeholder-dress.jpg';
  };

  const getProductName = (prod) => {
    const raw = prod.productId || prod;
    return raw?.name || prod.productName || 'Trang phục VESTORA';
  };

  // Submit for the currently selected product
  const handleSubmitSingle = async (e) => {
    e?.preventDefault();
    setErrorMessage('');

    if (!currentProdData.comment.trim()) {
      setErrorMessage('Vui lòng nhập nhận xét chi tiết về sản phẩm.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        orderId: order._id,
        orderType,
        productId: currentProdId,
        rating: currentProdData.rating,
        comment: currentProdData.comment.trim(),
      };

      await submitReview(payload);
      setSuccessMessage(`Đã gửi đánh giá cho "${getProductName(currentProduct)}"!`);

      setTimeout(() => {
        if (onSuccess) onSuccess(currentProdId);
        // If there are more products, move to next or close
        if (productsToReview.length > 1 && selectedIndex < productsToReview.length - 1) {
          setSelectedIndex((prev) => prev + 1);
          setSuccessMessage('');
        } else {
          onClose();
        }
      }, 1000);
    } catch (err) {
      setErrorMessage(err.message || 'Không thể gửi đánh giá. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit all reviews at once (Batch submission)
  const handleSubmitAll = async () => {
    setErrorMessage('');
    const batchList = [];

    for (const prod of productsToReview) {
      const pid = prod._id || prod.productId?._id || prod.productId;
      const data = reviewsData[pid] || { rating: 5, comment: '' };

      if (!data.comment.trim()) {
        setErrorMessage(`Vui lòng nhập nhận xét cho "${getProductName(prod)}".`);
        return;
      }

      batchList.push({
        productId: pid,
        rating: data.rating,
        comment: data.comment.trim(),
      });
    }

    setIsSubmitting(true);
    try {
      await submitBatchReviews({
        orderId: order._id,
        orderType,
        reviews: batchList,
      });

      setSuccessMessage('Đã lưu toàn bộ đánh giá cho đơn hàng thành công!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMessage(err.message || 'Không thể gửi danh sách đánh giá. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="v-review-modal-backdrop" onClick={onClose}>
      <div className="v-review-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="v-review-modal-header">
          <div>
            <div className="v-review-subtitle">
              Mã đơn: #{order.orderCode || String(order._id).slice(-8).toUpperCase()} ({orderType === 'rental' ? 'Đơn Thuê' : 'Đơn Mua'})
            </div>
            <h3 className="v-review-title">Đánh giá Trải nghiệm Trang phục</h3>
          </div>
          <button className="v-review-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        {/* Multi-product Selector Tabs if more than 1 product */}
        {productsToReview.length > 1 && (
          <div className="v-review-product-tabs">
            {productsToReview.map((prod, idx) => {
              const pid = prod._id || prod.productId?._id || prod.productId;
              const hasFilled = (reviewsData[pid]?.comment || '').trim().length > 0;
              return (
                <button
                  key={pid || idx}
                  type="button"
                  className={`v-review-tab-item ${selectedIndex === idx ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedIndex(idx);
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                >
                  <img src={getProductImage(prod)} alt="" className="v-review-tab-thumb" />
                  <span className="v-review-tab-label">
                    Món {idx + 1}
                    {hasFilled && <span className="v-review-done-dot">✓</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Product Banner */}
        <div className="v-review-product-banner">
          <img src={getProductImage(currentProduct)} alt="" className="v-review-product-img" />
          <div className="v-review-product-info">
            <h4 className="v-review-product-heading">{getProductName(currentProduct)}</h4>
            <div className="v-review-badge-verified">
              <Package size={13} /> Đã nhận hàng thành công
            </div>
          </div>
        </div>

        {/* Rating Stars Section */}
        <div className="v-review-rating-block">
          <div className="v-review-rating-label">Chất lượng và độ hoàn thiện của sản phẩm:</div>
          <div className="v-review-stars-wrapper">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoverRating || currentProdData.rating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  className="v-review-star-btn"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleRatingChange(star)}
                  aria-label={`${star} sao`}
                >
                  <Star
                    size={32}
                    className={`v-review-star-icon ${active ? 'filled' : 'empty'}`}
                  />
                </button>
              );
            })}
            <span className="v-review-score-text">
              {RATING_DESCRIPTIONS[hoverRating || currentProdData.rating]}
            </span>
          </div>
        </div>

        {/* Written Feedback Textarea */}
        <div className="v-review-comment-block">
          <label className="v-review-comment-label" htmlFor="v-review-textarea">
            Cảm nhận thực tế (Chất vải, độ mới, form dáng, trải nghiệm mặc):
          </label>
          <textarea
            id="v-review-textarea"
            className="v-review-textarea"
            rows={4}
            value={currentProdData.comment}
            onChange={(e) => handleCommentChange(e.target.value)}
            placeholder="Chia sẻ nhận xét của bạn để giúp các khách hàng khác chọn size và phong cách phù hợp..."
            maxLength={1000}
          />
          <div className="v-review-char-count">
            {currentProdData.comment.length} / 1000 ký tự
          </div>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="v-review-alert error">{errorMessage}</div>
        )}
        {successMessage && (
          <div className="v-review-alert success">
            <CheckCircle size={16} /> {successMessage}
          </div>
        )}

        {/* Modal Actions */}
        <div className="v-review-modal-actions">
          <button
            type="button"
            className="v-review-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy
          </button>

          {productsToReview.length > 1 && (
            <button
              type="button"
              className="v-review-btn-batch"
              onClick={handleSubmitAll}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                `Gửi tất cả (${productsToReview.length} món)`
              )}
            </button>
          )}

          <button
            type="button"
            className="v-review-btn-primary"
            onClick={handleSubmitSingle}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              productsToReview.length > 1
                ? (selectedIndex < productsToReview.length - 1 ? 'Lưu & Sang món tiếp theo' : 'Gửi Đánh Giá Món Này')
                : 'Gửi Đánh Giá'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
