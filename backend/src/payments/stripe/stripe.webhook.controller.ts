import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentsService } from '../payments.service';
import { StripeService } from './stripe.service';

@Controller('payments/stripe')
export class StripeWebhookController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeService,
  ) {}

  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response) {
    try {
      const event = this.stripe.constructEvent(req.body as Buffer, req.headers['stripe-signature']);
      await this.payments.handleStripeWebhook(event);
      return res.json({ received: true });
    } catch (err: any) {
      const message = err?.message || 'Unknown webhook error';
      return res.status(400).send(`Webhook Error: ${message}`);
    }
  }
}
