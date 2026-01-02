import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './booking.entity';
import { Trip } from '../trips/trip.entity';
import { TripsModule } from '../trips/trips.module';
import { BookingReferenceService } from './booking-reference.service';
import { TripSeat } from 'src/trips/trip-seat.entity';
import { BookingDetail } from './booking-detail.entity';
import { SeatMap } from 'src/seat-maps/seat-map.entity';
import { RedisModule } from 'src/redis/redis.module';
import { SeatValidationService } from 'src/trips/seat-validation.service';
import { RealtimeModule } from 'src/realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Trip, BookingDetail, TripSeat, SeatMap]),
    TripsModule,
    RedisModule,
    RealtimeModule,
  ],
  providers: [BookingsService, BookingReferenceService, SeatValidationService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
