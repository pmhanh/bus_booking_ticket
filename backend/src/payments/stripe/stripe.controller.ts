import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from '../payments.service';

@Controller('payments/stripe')
export class StripeController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create')
  async create(@Body() body: { bookingId: string; email?: string }) {
    return this.payments.createStripeCheckout(body.bookingId, body.email);
  }
}
