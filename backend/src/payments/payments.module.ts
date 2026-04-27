import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe/stripe.service';
import { StripeController } from './stripe/stripe.controller';
import { StripeWebhookController } from './stripe/stripe.webhook.controller';

import { Booking } from 'src/bookings/booking.entity';
import { BookingsModule } from 'src/bookings/bookings.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Booking]),
    BookingsModule,
  ],
  controllers: [StripeController, StripeWebhookController],
  providers: [PaymentsService, StripeService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
