import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { TripsPublicController } from './trips-public.controller';
import { Trip } from './trip.entity';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { SeatLock } from './seat-lock.entity';
import { TripSeatsService } from './trip-seats.service';
import { TripSeatsController } from './trip-seats.controller';
import { Booking } from '../bookings/booking.entity';
import { SeatValidationService } from './seat-validation.service';
import { SeatLockScheduler } from './seat-lock.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Route, Bus, SeatMap, SeatLock, Booking]),
  ],
  providers: [
    TripsService,
    TripSeatsService,
    SeatValidationService,
    SeatLockScheduler,
  ],
  controllers: [TripsController, TripsPublicController, TripSeatsController],
  exports: [TripSeatsService, SeatValidationService],
})
export class TripsModule {}
