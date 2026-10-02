import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from 'src/infrastructure/realtime/realtime.module';
import { RedisModule } from 'src/infrastructure/redis/redis.module';
import { TripSeat } from './trip-seat.entity';
import { Trip } from '../trips/trip.entity';
import { SeatHoldController } from './seat-hold.controller';
import { SeatHoldService } from './seat-hold.service';
import { SeatValidationService } from './seat-validation.service';
import { TripSeatsController } from './trip-seats.controller';
import { TripSeatsService } from './trip-seats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripSeat]),
    RedisModule,
    RealtimeModule,
  ],
  providers: [TripSeatsService, SeatHoldService, SeatValidationService],
  controllers: [TripSeatsController, SeatHoldController],
  exports: [TripSeatsService, SeatHoldService, SeatValidationService],
})
export class TripInventoryModule {}
