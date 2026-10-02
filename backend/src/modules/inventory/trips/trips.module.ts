import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingDetail } from '../../sales/bookings/entities/booking-detail.entity';
import { Bus } from '../../fleet/buses/bus.entity';
import { Route } from '../../fleet/routes/route.entity';
import { Trip } from './trip.entity';
import { TripsController } from './trips.admin.controller';
import { TripsPublicController } from './trips.client.controller';
import { TripsService } from './trips.service';
import { PaymentsModule } from '../../sales/payments/payments.module';
import { BookingsModule } from '../../sales/bookings/bookings.module';
import { MailModule } from '../../../infrastructure/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Route, Bus, BookingDetail]),
    PaymentsModule,
    BookingsModule,
    MailModule,
  ],
  providers: [TripsService],
  controllers: [TripsController, TripsPublicController],
  exports: [TripsService],
})
export class TripsCatalogModule {}
