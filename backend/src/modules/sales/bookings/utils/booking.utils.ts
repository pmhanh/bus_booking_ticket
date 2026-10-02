import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { normalizeEmail } from '../../../../core/utils/email.util';
import { TripStatus } from '../../../inventory/trips/trip.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';

export type BookingAccess = {
  userId?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export function assertBookingAccess(booking: Booking, access: BookingAccess) {
  if (booking.user?.id) {
    if (booking.user.id !== access.userId)
      throw new ForbiddenException('Booking belongs to another user');
    return;
  }
  const emailMatch =
    access.contactEmail &&
    normalizeEmail(booking.contactEmail) ===
      normalizeEmail(access.contactEmail);
  const phoneMatch =
    access.contactPhone &&
    booking.contactPhone?.trim() === access.contactPhone.trim();
  if (!emailMatch && !phoneMatch)
    throw new ForbiddenException('Contact information does not match booking');
}

export function isBookingExpired(booking: Booking) {
  return (
    booking.status === BookingStatus.EXPIRED ||
    (booking.status === BookingStatus.PENDING &&
      !!booking.expiresAt &&
      booking.expiresAt.getTime() <= Date.now())
  );
}

export function assertTripOpen(booking: Booking) {
  const trip = booking.trip;
  if (
    ![TripStatus.SCHEDULED, TripStatus.DELAYED].includes(trip.status) ||
    trip.departureTime.getTime() <= Date.now()
  ) {
    throw new BadRequestException(
      'Trip is no longer available for booking changes',
    );
  }
}

export function assertBookingEditable(booking: Booking) {
  if (booking.status === BookingStatus.CANCELLED || isBookingExpired(booking)) {
    throw new BadRequestException(
      'Cannot update a cancelled or expired booking',
    );
  }
  assertTripOpen(booking);
}

export function bookingSeatCodes(booking: Booking) {
  return booking.details.map((detail) => detail.seatCodeSnapshot);
}
