import { apiClient } from '../../../shared/api/api';
import type {
  Booking,
  BookingResponse,
  PassengerInput,
} from '../types/booking';
import { normalizeBooking } from '../utils/bookingPassengers';

export type CreateBookingPayload = {
  tripId: number;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  passengers: PassengerInput[];
  lockToken: string;
  pickupStopId?: number;
  dropoffStopId?: number;
};

export type CreateBookingResponse = {
  ok: true;
  booking: Booking;
};

export type LookupBookingsResponse = {
  data: Booking[];
  total: number;
  limit: number;
};

export async function createBooking(payload: CreateBookingPayload) {
  const response = await apiClient<
    Omit<CreateBookingResponse, 'booking'> & { booking: BookingResponse }
  >('/bookings', {
    method: 'POST',
    body: payload,
  });
  return { ...response, booking: normalizeBooking(response.booking) };
}

export async function getMyBookings() {
  const response = await apiClient<BookingResponse[]>('/bookings/my');
  return response.map(normalizeBooking);
}

export async function lookupBooking(
  phone?: string,
  email?: string,
  tripDate?: string,
) {
  const qs = new URLSearchParams();
  if (phone) qs.set('phone', phone);
  if (email) qs.set('email', email);
  if (tripDate) qs.set('tripDate', tripDate);
  const response = await apiClient<
    Omit<LookupBookingsResponse, 'data'> & { data: BookingResponse[] }
  >(`/bookings/lookup?${qs.toString()}`, {
    method: 'GET',
  });
  return { ...response, data: response.data.map(normalizeBooking) };
}

export async function getBooking(
  id: string,
  contact?: { phone?: string; email?: string },
) {
  const qs = new URLSearchParams();
  if (contact?.phone) qs.set('phone', contact.phone);
  if (contact?.email) qs.set('email', contact.email);

  const path = qs.toString()
    ? `/bookings/${id}?${qs.toString()}`
    : `/bookings/${id}`;
  return normalizeBooking(await apiClient<BookingResponse>(path));
}

export async function cancelBooking(
  id: string,
  contact?: { phone?: string; email?: string },
  pendingOnly = false,
) {
  const body = {
    ...(pendingOnly ? { pendingOnly: true } : {}),
    contactPhone: contact?.phone,
    contactEmail: contact?.email,
  };

  return normalizeBooking(
    await apiClient<BookingResponse>(`/bookings/${id}/cancel`, {
      method: 'PATCH',
      body,
    }),
  );
}
