import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { TripsPublicController } from './trips-public.controller';
import { Trip } from './trip.entity';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { TripSeatsService } from './trip-seats.service';
import { TripSeatsController } from './trip-seats.controller';
import { Booking } from '../bookings/booking.entity';
import { RedisModule } from 'src/redis/redis.module';
import { TripSeat } from './trip-seat.entity';
import { SeatHoldService } from './seat-hold.service';
import { SeatHoldController } from './seat-hold.controller';
import { RealtimeModule } from 'src/realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Route, Bus, SeatMap, TripSeat]),
    RedisModule,
    RealtimeModule
  ],
  providers: [
    TripsService,
    TripSeatsService,
    SeatHoldService
  ],
  controllers: [TripsController, TripsPublicController, TripSeatsController, SeatHoldController],
  exports: [TripSeatsService],
})
export class TripsModule {}
