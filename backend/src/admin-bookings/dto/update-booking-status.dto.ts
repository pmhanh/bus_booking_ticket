import { IsEnum } from 'class-validator';
import { BookingStatus } from '../../bookings/booking.entity';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status: BookingStatus;
}
