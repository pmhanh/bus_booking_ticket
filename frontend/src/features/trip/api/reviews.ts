import { apiClient } from '../../../shared/api/api';
import type { TripReviewsResponse, Review } from '../types/review';

export function getTripReviews(tripId: number) {
  return apiClient<TripReviewsResponse>(`/trips/${tripId}/reviews`, { method: 'GET' });
}

export function createTripReview(
  tripId: number,
  payload: { rating: number; content: string },
  token: string,
) {
  return apiClient<Review>(`/trips/${tripId}/reviews`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}
