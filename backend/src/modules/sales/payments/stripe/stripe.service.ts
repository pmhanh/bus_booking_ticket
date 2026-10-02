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

  async createCheckoutSession(params: {
    bookingId: string;
    paymentId: string;
    amount: number;
    email?: string;
    idempotencyKey: string;
  }) {
    const successUrl = this.config.get<string>('STRIPE_SUCCESS_URL');
    const cancelUrl = this.config.get<string>('STRIPE_CANCEL_URL');

    if (!successUrl || !cancelUrl) {
      throw new Error('Stripe success/cancel URLs are not configured');
    }

    const returnUrl = (base: string) => {
      const url = new URL(base);
      url.searchParams.set('booking_id', params.bookingId);
      return url
        .toString()
        .replace(/%7BCHECKOUT_SESSION_ID%7D/g, '{CHECKOUT_SESSION_ID}');
    };
    const session = await this.stripe.checkout.sessions.create(
      {
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
        success_url: returnUrl(successUrl),
        cancel_url: returnUrl(cancelUrl),
        metadata: { bookingId: params.bookingId, paymentId: params.paymentId },
      },
      { idempotencyKey: params.idempotencyKey },
    );

    if (!session.url) {
      throw new Error('Stripe did not return checkout URL');
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
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

  retrieveCheckoutSession(id: string) {
    return this.stripe.checkout.sessions.retrieve(id);
  }

  async expireCheckoutSession(id: string) {
    const session = await this.retrieveCheckoutSession(id);
    if (session.status === 'open')
      await this.stripe.checkout.sessions.expire(id);
  }

  async findCompletedCheckoutEvent(sessionId: string, since: Date) {
    for await (const event of this.stripe.events.list({
      type: 'checkout.session.completed',
      created: { gte: Math.floor(since.getTime() / 1000) },
      limit: 100,
    })) {
      if (
        event.type === 'checkout.session.completed' &&
        event.data.object.id === sessionId
      )
        return event;
    }
    return null;
  }

  async refundPaymentIntent(params: {
    paymentIntentId: string;
    amount: number;
    idempotencyKey: string;
    stripeRefundId?: string;
  }) {
    if (params.stripeRefundId)
      return this.stripe.refunds.retrieve(params.stripeRefundId);
    // Recover a request even if its response was lost and the idempotency cache expired.
    for await (const previous of this.stripe.refunds.list({
      payment_intent: params.paymentIntentId,
      limit: 100,
    })) {
      if (previous.metadata?.requestId === params.idempotencyKey)
        return this.stripe.refunds.retrieve(previous.id);
    }
    const refund = await this.stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        amount: params.amount,
        metadata: { requestId: params.idempotencyKey },
      },
      { idempotencyKey: params.idempotencyKey },
    );
    return refund.status === 'pending'
      ? this.stripe.refunds.retrieve(refund.id)
      : refund;
  }
}
