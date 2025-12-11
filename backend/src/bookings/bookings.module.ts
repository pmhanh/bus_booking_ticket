import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './booking.entity';
import { Trip } from '../trips/trip.entity';
import { SeatLock } from '../trips/seat-lock.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { TripsModule } from '../trips/trips.module';
import { BookingReferenceService } from './booking-reference.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Trip, SeatLock, SeatMap]),
    TripsModule,
  ],
  providers: [BookingsService, BookingReferenceService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
