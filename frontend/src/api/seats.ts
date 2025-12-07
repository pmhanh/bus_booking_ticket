import { apiClient } from '../lib/api';
import type { SeatAvailability } from '../types/seatMap';

export type SeatLockResponse = {
  lockToken: string;
  expiresAt: string;
  seats: string[];
  availability: SeatAvailability;
};

export function fetchSeatAvailability(tripId: number, lockToken?: string) {
  const qs = lockToken ? `?lockToken=${lockToken}` : '';
  return apiClient<SeatAvailability>(`/trips/${tripId}/seat-map${qs}`);
}

export function lockSeats(
  tripId: number,
  params: { seats: string[]; holdMinutes?: number; lockToken?: string },
  accessToken: string,
) {
  return apiClient<SeatLockResponse>(`/trips/${tripId}/seat-locks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(params),
  });
}

export function refreshSeatLock(
  tripId: number,
  lockToken: string,
  accessToken: string,
  holdMinutes?: number,
) {
  return apiClient<SeatLockResponse>(`/trips/${tripId}/seat-locks/${lockToken}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ holdMinutes }),
  });
}

export function releaseSeatLock(tripId: number, lockToken: string, accessToken: string) {
  return apiClient<{ released: boolean; availability: SeatAvailability }>(
    `/trips/${tripId}/seat-locks/${lockToken}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}
