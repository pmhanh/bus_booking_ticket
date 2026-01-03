import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from './admin-bookings.service';
import { Booking } from '../bookings/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { TripSeat } from '../trips/trip-seat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Payment, TripSeat])],
  controllers: [AdminBookingsController],
  providers: [AdminBookingsService],
})
export class AdminBookingsModule {}
