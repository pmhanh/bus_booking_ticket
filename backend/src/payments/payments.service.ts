import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';

import { Payment, PaymentProvider, PaymentStatus } from './entities/payment.entity';
import { StripeService } from './stripe/stripe.service';
import { Booking } from '../bookings/booking.entity';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly stripeService: StripeService,
    private readonly bookingsService: BookingsService,
  ) {}

  async createStripeCheckout(bookingId: string, email?: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId } as any,
      relations: ['trip', 'trip.route', 'trip.route.originCity', 'trip.route.destinationCity', 'details', 'details.tripSeat'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING booking can be paid');
    }
    if (booking.expiresAt && booking.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Booking expired');
    }

    const amount = booking.totalPrice;
    if (!amount || amount <= 0) throw new BadRequestException('Invalid totalPrice');

    const existing = await this.paymentRepo.findOne({
      where: { provider: PaymentProvider.STRIPE, booking: { id: bookingId } },
    });
    if (existing?.status === PaymentStatus.SUCCESS) {
      throw new BadRequestException('Booking already paid via Stripe');
    }

    const session = await this.stripeService.createCheckoutSession({
      bookingId,
      amount,
      email: email || booking.contactEmail || undefined,
    });

    await this.paymentRepo.save({
      id: existing?.id,
      booking,
      provider: PaymentProvider.STRIPE,
      status: PaymentStatus.PENDING,
      amount,
      orderId: session.sessionId,
      stripePaymentIntentId: session.sessionId,
      raw: { session },
    });

    return {
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
    };
  }

  async handleStripeWebhook(event: Stripe.Event) {
    if (event.type !== 'checkout.session.completed') {
      return { ok: true };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      throw new BadRequestException('Missing bookingId in Stripe metadata');
    }

    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } as any });
    if (!booking) throw new NotFoundException('Booking not found');

    const amountPaid = session.amount_total ?? booking.totalPrice;

    const payment = await this.paymentRepo.findOne({
      where: { provider: PaymentProvider.STRIPE, orderId: session.id },
    });
    if (payment?.status === PaymentStatus.SUCCESS) return { ok: true };

    await this.paymentRepo.save({
      id: payment?.id,
      booking,
      provider: PaymentProvider.STRIPE,
      status: PaymentStatus.SUCCESS,
      amount: amountPaid,
      orderId: session.id,
      stripePaymentIntentId: (session.payment_intent as string) ?? session.id,
      message: event.type,
      raw: event,
    });

    await this.bookingsService.confirmPaidBooking(booking.id, {
      provider: 'STRIPE',
      orderId: session.id,
      paidAmount: amountPaid,
      raw: event,
    });

    return { ok: true };
  }
}
