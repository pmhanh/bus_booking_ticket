import { apiClient } from '../lib/api';
import type { Booking, PassengerInput, SeatStatusResponse } from '../types/booking';

export type CreateBookingPayload = {
  tripId: number;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  seats: string[];
  passengers?: PassengerInput[];
  lockToken?: string;
};

export async function getSeatStatus(tripId: number, lockToken?: string) {
  const qs = lockToken ? `?lockToken=${encodeURIComponent(lockToken)}` : '';
  return apiClient<SeatStatusResponse>(`/bookings/trips/${tripId}/seats${qs}`, { method: 'GET' });
}

export async function createBooking(payload: CreateBookingPayload, token?: string | null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  return apiClient<Booking>('/bookings', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

export async function getMyBookings(token: string) {
  return apiClient<Booking[]>('/bookings/my', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function lookupBooking(code: string, phone?: string, email?: string) {
  const qs = new URLSearchParams();
  qs.set('reference', code);
  if (phone) qs.set('phone', phone);
  if (email) qs.set('email', email);
  return apiClient<Booking>(`/bookings/lookup?${qs.toString()}`, { method: 'GET' });
}

export async function getBooking(id: string, token?: string | null, contact?: { phone?: string; email?: string }) {
  const qs = new URLSearchParams();
  if (contact?.phone) qs.set('phone', contact.phone);
  if (contact?.email) qs.set('email', contact.email);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const path = qs.toString() ? `/bookings/${id}?${qs.toString()}` : `/bookings/${id}`;
  return apiClient<Booking>(path, { method: 'GET', headers });
}

export async function cancelBooking(
  id: string,
  token?: string | null,
  contact?: { phone?: string; email?: string },
) {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  return apiClient<Booking>(`/bookings/${id}/cancel`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(contact || {}),
  });
}

export async function updateBooking(
  id: string,
  payload: Partial<CreateBookingPayload>,
  token?: string | null,
) {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  return apiClient<Booking>(`/bookings/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
}
