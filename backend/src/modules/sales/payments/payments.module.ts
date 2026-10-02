import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentRefundModule } from './payment-refund.module';
import { StripeController } from './stripe/stripe.controller';
import { StripeWebhookController } from './stripe/stripe.webhook.controller';

import { Booking } from '../bookings/entities/booking.entity';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Booking]),
    BookingsModule,
    PaymentRefundModule,
  ],
  controllers: [StripeController, StripeWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
