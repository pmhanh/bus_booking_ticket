import { apiClient } from '../../../shared/api/api';
import type { SeatAvailability } from '../../seatmap/types/seatMap';

const STATUS_PATH = (tripId: number) => `/trips/${tripId}/seats/status`;
const LEGACY_STATUS_PATH = (tripId: number) => `/trips/${tripId}/seat-map`;
const HOLD_PATH = (tripId: number) => `/trips/${tripId}/seats/hold`;
const RELEASE_PATH = (tripId: number) => `/trips/${tripId}/seats/release`;

export async function fetchSeatStatus(tripId: number) {
  try {
    return await apiClient<SeatAvailability>(STATUS_PATH(tripId));
  } catch (err) {
    // Fallback to legacy path if server hasn't been updated yet
    return apiClient<SeatAvailability>(LEGACY_STATUS_PATH(tripId));
  }
}

export function holdSeats(
  tripId: number,
  seatCodes: string[],
  ttlSeconds = 120,
) {
  return apiClient<{ ok: boolean; seatCodes: string[]; lockToken: string; expiresAt: string }>(
    HOLD_PATH(tripId),
    {
      method: 'POST',
      body: JSON.stringify({ seatCodes, ttlSeconds }),
    },
  );
}

export function releaseSeats(tripId: number, seatCodes: string[], lockToken: string) {
  return apiClient<{ ok: boolean }>(RELEASE_PATH(tripId), {
    method: 'POST',
    body: JSON.stringify({ seatCodes, lockToken }),
  });
}
