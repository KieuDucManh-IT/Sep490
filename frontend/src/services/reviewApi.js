import { apiClient } from './api';

export const submitReview = async (payload) => {
  return apiClient.post('/reviews', payload);
};

export const submitBatchReviews = async (payload) => {
  return apiClient.post('/reviews/batch', payload);
};

export const getProductReviews = async (productId, params = {}) => {
  return apiClient.get(`/reviews/product/${productId}`, { params });
};

export const getOrderReviews = async (orderId) => {
  return apiClient.get(`/reviews/order/${orderId}`);
};

export const checkReviewEligibility = async (productId) => {
  return apiClient.get(`/reviews/check-eligibility/${productId}`);
};

export const replyToReview = async (reviewId, replyText) => {
  return apiClient.post(`/reviews/${reviewId}/reply`, { replyText });
};
