import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { RedisModule } from 'src/infrastructure/redis/redis.module';
import { RealtimeModule } from 'src/infrastructure/realtime/realtime.module';
import { PaymentRefundModule } from '../payments/payment-refund.module';
import { BookingQueryService } from './services/booking-query.service';
import { BookingTicketService } from './services/booking-ticket.service';
import { BookingsClientController } from './controllers/bookings.client.controller';
import { BookingsAdminController } from './controllers/bookings.admin.controller';
import { TripInventoryModule } from '../../inventory/trip-seats/trip-seats.module';
import { MailModule } from 'src/infrastructure/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking]),
    PaymentRefundModule,
    TripInventoryModule,
    RedisModule,
    RealtimeModule,
    MailModule,
  ],
  providers: [BookingsService, BookingQueryService, BookingTicketService],
  controllers: [BookingsClientController, BookingsAdminController],
  exports: [BookingsService],
})
export class BookingsModule {}
