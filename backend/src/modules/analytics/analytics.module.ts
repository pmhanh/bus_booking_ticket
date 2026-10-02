import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../sales/bookings/entities/booking.entity';
import { Payment } from '../sales/payments/entities/payment.entity';
import { TripSeat } from '../inventory/trip-seats/trip-seat.entity';
import { Trip } from '../inventory/trips/trip.entity';
import { User } from '../iam/users/user.entity';
import { AnalyticsAdminController } from './analytics.admin.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Payment, Trip, TripSeat, User])],
  controllers: [AnalyticsAdminController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class AnalyticsModule {}
