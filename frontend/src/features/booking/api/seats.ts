import { apiClient } from '../../../shared/api/api';
import type { SeatAvailability } from '../../seatmap/types/seatMap';

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
  params: { seats: string[]; holdMinutes?: number; lockToken?: string; guestSessionId?: string },
  accessToken?: string,
) {
  return apiClient<SeatLockResponse>(`/trips/${tripId}/seat-locks`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: JSON.stringify(params),
  });
}

export function refreshSeatLock(
  tripId: number,
  lockToken: string,
  accessToken?: string,
  holdMinutes?: number,
  guestSessionId?: string,
) {
  return apiClient<SeatLockResponse>(`/trips/${tripId}/seat-locks/${lockToken}`, {
    method: 'PATCH',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: JSON.stringify({ holdMinutes, guestSessionId }),
  });
}

export function releaseSeatLock(
  tripId: number,
  lockToken: string,
  accessToken?: string,
  guestSessionId?: string,
) {
  const qs = guestSessionId ? `?guestSessionId=${encodeURIComponent(guestSessionId)}` : '';
  return apiClient<{ released: boolean; availability: SeatAvailability }>(
    `/trips/${tripId}/seat-locks/${lockToken}${qs}`,
    {
      method: 'DELETE',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    },
  );
}
