import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from 'src/bookings/booking.entity';
import { BookingsModule } from 'src/bookings/bookings.module';
import { ConfigModule } from '@nestjs/config';
import { Payment } from './entities/payment.entity';
import { MomoConfig } from './momo/momo.config';
import { BookingReferenceService } from 'src/bookings/booking-reference.service';
import { StripeService } from './stripe/stripe.service';
import { StripeController } from './stripe/stripe.controller';
import { StripeWebhookController } from './stripe/stripe.webhook.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Booking]),
    BookingsModule,
  ],
  controllers: [PaymentsController, StripeController, StripeWebhookController],
  providers: [PaymentsService, MomoConfig, BookingReferenceService, StripeService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
