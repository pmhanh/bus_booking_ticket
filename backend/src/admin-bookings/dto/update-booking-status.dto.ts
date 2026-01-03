import { IsEnum } from 'class-validator';
import type { BookingStatus } from '../../bookings/booking.entity';

export class UpdateBookingStatusDto {
  @IsEnum(['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'])
  status: BookingStatus;
}
