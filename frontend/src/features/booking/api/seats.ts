import { apiClient } from '../../../shared/api/api';
import type { SeatAvailability } from '../../seatmap/types/seatMap';

const STATUS_PATH = (tripId: number) => `/trips/${tripId}/seats/status`;
const HOLD_PATH = (tripId: number) => `/trips/${tripId}/seats/hold`;
const RELEASE_PATH = (tripId: number) => `/trips/${tripId}/seats/release`;

export function fetchSeatStatus(tripId: number) {
  return apiClient<SeatAvailability>(STATUS_PATH(tripId));
}

export function holdSeats(
  tripId: number,
  seatCodes: string[],
  ttlSeconds = 300,
) {
  return apiClient<{
    ok: boolean;
    seatCodes: string[];
    lockToken: string;
    expiresAt: string;
  }>(HOLD_PATH(tripId), {
    method: 'POST',
    body: { seatCodes, ttlSeconds },
  });
}

export function releaseSeats(
  tripId: number,
  seatCodes: string[],
  lockToken: string,
) {
  return apiClient<{ ok: boolean }>(RELEASE_PATH(tripId), {
    method: 'POST',
    body: { seatCodes, lockToken },
  });
}
