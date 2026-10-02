import { apiClient } from '../../../shared/api/api';
import type { TripReviewsResponse, Review } from '../types/review';

export function getTripReviews(tripId: number) {
  return apiClient<TripReviewsResponse>(`/trips/${tripId}/reviews`, {
    method: 'GET',
  });
}

export function createTripReview(
  tripId: number,
  payload: { rating: number; content: string },
) {
  return apiClient<Review>(`/trips/${tripId}/reviews`, {
    method: 'POST',
    body: payload,
  });
}

export function updateTripReview(
  reviewId: string,
  payload: { rating: number; content: string },
) {
  return apiClient<Review>(`/reviews/${reviewId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteTripReview(reviewId: string) {
  return apiClient<{ ok: boolean }>(`/reviews/${reviewId}`, {
    method: 'DELETE',
  });
}
