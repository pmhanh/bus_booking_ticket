import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './booking.entity';
import { Trip } from '../trips/trip.entity';
import { SeatLock } from '../trips/seat-lock.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Trip, SeatLock, SeatMap]),
  ],
  providers: [BookingsService],
  controllers: [BookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
