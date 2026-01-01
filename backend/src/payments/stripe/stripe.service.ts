import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secret) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secret);
  }

  async createCheckoutSession(params: { bookingId: string; amount: number; email?: string }) {
    const successUrl = this.config.get<string>('STRIPE_SUCCESS_URL');
    const cancelUrl = this.config.get<string>('STRIPE_CANCEL_URL');

    if (!successUrl || !cancelUrl) {
      throw new Error('Stripe success/cancel URLs are not configured');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: params.email,
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'vnd',
            // VND is zero-decimal in Stripe
            unit_amount: params.amount,
            product_data: {
              name: `Bus ticket booking ${params.bookingId}`,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { bookingId: params.bookingId },
    });

    if (!session.url) {
      throw new Error('Stripe did not return checkout URL');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      amountTotal: session.amount_total ?? params.amount,
    };
  }

  constructEvent(rawBody: Buffer, signature: string | string[] | undefined) {
    const endpointSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!endpointSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    if (!signature) {
      throw new Error('Missing Stripe signature header');
    }

    return this.stripe.webhooks.constructEvent(
      rawBody,
      Array.isArray(signature) ? signature[0] : signature,
      endpointSecret,
    );
  }
}
