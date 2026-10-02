import type {
  Booking,
  BookingPassenger,
  BookingResponse,
} from '../types/booking';

export function getBookingPassengers(
  booking: BookingResponse,
): BookingPassenger[] {
  return (
    booking.passengers ??
    booking.details?.map((detail) => ({
      seatCode: detail.seatCodeSnapshot,
      name: detail.passengerName,
      phone: detail.passengerPhone,
      idNumber: detail.passengerIdNumber,
      price: detail.priceSnapshot,
    })) ??
    []
  );
}

export function normalizeBooking(booking: BookingResponse): Booking {
  return { ...booking, passengers: getBookingPassengers(booking) };
}
