import {
  Controller,
  HttpException,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentsService } from '../payments.service';
import { StripeService } from './stripe.service';

@Controller('payments/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeService,
  ) {}

  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response) {
    let event;
    try {
      event = this.stripe.constructEvent(
        req.body as Buffer,
        req.headers['stripe-signature'],
      );
    } catch (err: any) {
      const message = err?.message || 'Unknown webhook error';
      return res.status(400).send(`Webhook Error: ${message}`);
    }
    try {
      await this.payments.handleStripeWebhook(event);
      return res.json({ received: true });
    } catch (error) {
      this.logger.error('Stripe webhook processing failed', error);
      return res
        .status(error instanceof HttpException ? error.getStatus() : 500)
        .json({ message: 'Webhook processing failed' });
    }
  }
}
