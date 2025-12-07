import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Trip } from '../trips/trip.entity';
import { User } from '../users/user.entity';
import { SeatDefinition } from '../seat-maps/seat-definition.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Trip, User, SeatDefinition])],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
