import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentRefundService } from './payment-refund.service';
import { StripeService } from './stripe/stripe.service';

@Module({
  imports: [ConfigModule],
  providers: [StripeService, PaymentRefundService],
  exports: [StripeService, PaymentRefundService],
})
export class PaymentRefundModule {}
