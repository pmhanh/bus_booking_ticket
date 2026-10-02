import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import Stripe from 'stripe';
import {
  Payment,
  PaymentProvider,
  PaymentStatus,
  RefundMethod,
} from './entities/payment.entity';
import { StripeService } from './stripe/stripe.service';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { BookingsService } from '../bookings/bookings.service';
import {
  assertBookingAccess,
  assertTripOpen,
} from '../bookings/utils/booking.utils';
import { Trip, TripStatus } from '../../inventory/trips/trip.entity';
import { PaymentRefundService } from './payment-refund.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly stripeService: StripeService,
    private readonly bookingsService: BookingsService,
    private readonly refunds: PaymentRefundService,
  ) {}

  async createStripeCheckout(
    bookingId: string,
    email?: string,
    userId?: string,
  ) {
    if (!isUUID(bookingId)) throw new BadRequestException('Invalid booking ID');
    const { booking, payment } = await this.bookingRepo.manager.transaction(
      async (manager) => {
        const initial = await manager.findOne(Booking, {
          where: { id: bookingId },
          relations: ['user', 'trip'],
        });
        if (!initial) throw new NotFoundException('Booking not found');
        assertBookingAccess(initial, { userId, contactEmail: email });
        const trip = await manager.findOneOrFail(Trip, {
          where: { id: initial.trip.id },
          lock: { mode: 'pessimistic_write' },
        });
        const booking = await manager.findOneOrFail(Booking, {
          where: { id: bookingId },
          lock: { mode: 'pessimistic_write' },
        });
        booking.trip = trip;
        this.assertPayable(booking);
        await this.bookingsService.startPaymentHold(manager, booking);
        const payments = await manager.find(Payment, {
          where: { booking: { id: bookingId } },
          order: { createdAt: 'DESC' },
        });
        if (
          payments.some((p) =>
            [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED].includes(p.status),
          )
        )
          throw new BadRequestException(
            'Booking already has a completed payment',
          );
        let payment = payments.find((p) =>
          [PaymentStatus.INIT, PaymentStatus.PENDING].includes(p.status),
        );
        if (!payment) {
          const id = randomUUID();
          payment = await manager.save(Payment, {
            id,
            booking,
            provider: PaymentProvider.STRIPE,
            status: PaymentStatus.INIT,
            amount: booking.totalPrice,
            orderId: `checkout-${id}`,
            raw: { checkoutEmail: booking.contactEmail },
          });
        }
        return { booking, payment };
      },
    );
    let session: { sessionId: string; checkoutUrl: string };
    if (payment.orderId.startsWith('cs_')) {
      const existing = await this.stripeService.retrieveCheckoutSession(
        payment.orderId,
      );
      if (existing.status === 'complete') {
        const event = await this.stripeService.findCompletedCheckoutEvent(
          existing.id,
          payment.createdAt,
        );
        if (event) await this.handleStripeWebhook(event);
        throw new ConflictException(
          'Phiên thanh toán đã hoàn tất. Vui lòng cập nhật trạng thái đơn; không thanh toán lại.',
        );
      }
      if (existing.status === 'expired') {
        await this.bookingsService.expireUnpaidCheckout(booking.id);
        await this.paymentRepo.update(
          { id: payment.id, status: PaymentStatus.PENDING },
          { status: PaymentStatus.FAILED },
        );
        throw new BadRequestException(
          'Phiên thanh toán đã hết hạn. Vui lòng chọn lại ghế.',
        );
      }
      if (existing.status !== 'open' || !existing.url)
        throw new ConflictException(
          'Chưa thể mở lại phiên thanh toán. Vui lòng cập nhật trạng thái đơn.',
        );
      session = { sessionId: existing.id, checkoutUrl: existing.url };
    } else {
      session = await this.createOrRecoverCheckout(payment, booking);
      await this.paymentRepo.update(
        { id: payment.id, status: PaymentStatus.INIT },
        {
          orderId: session.sessionId,
          status: PaymentStatus.PENDING,
        },
      );
    }
    const latest = await this.bookingRepo.findOneOrFail({
      where: { id: bookingId },
      relations: ['trip'],
    });
    try {
      this.assertPayable(latest);
    } catch (error) {
      await this.stripeService.expireCheckoutSession(session.sessionId);
      throw error;
    }
    return { ...session, expiresAt: latest.checkoutExpiresAt };
  }

  private async createOrRecoverCheckout(payment: Payment, booking: Booking) {
    const raw: unknown = payment.raw;
    const email =
      raw &&
      typeof raw === 'object' &&
      'checkoutEmail' in raw &&
      typeof raw.checkoutEmail === 'string'
        ? raw.checkoutEmail
        : booking.contactEmail;
    try {
      return await this.stripeService.createCheckoutSession({
        bookingId: booking.id,
        paymentId: payment.id,
        amount: payment.amount,
        email,
        idempotencyKey: `checkout-${payment.id}`,
      });
    } catch (error) {
      // Only a definitive rejection of the amount proves that no session was
      // created. Timeouts, rate limits and ambiguous errors must remain retryable.
      const amountTooSmall =
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        (error.code === 'amount_too_small' ||
          /total amount must (?:convert to|be) at least/i.test(error.message));
      if (!amountTooSmall) throw error;

      const message =
        'Tổng tiền đơn hàng thấp hơn mức tối thiểu Stripe cho phép. Đơn chưa thanh toán đã hết hiệu lực; vui lòng chọn lại chuyến hoặc ghế với giá vé phù hợp.';
      // Release the unpaid reservation before stopping reconciliation. If this
      // fails, leave the payment retryable so cleanup is not silently lost.
      await this.bookingsService.expireUnpaidCheckout(booking.id);
      await this.paymentRepo.update(
        { id: payment.id, orderId: payment.orderId, status: payment.status },
        { status: PaymentStatus.FAILED, message },
      );
      throw new BadRequestException(message);
    }
  }

  private assertPayable(booking: Booking) {
    if (
      booking.status !== BookingStatus.PENDING ||
      !booking.expiresAt ||
      booking.expiresAt.getTime() <= Date.now()
    )
      throw new BadRequestException(
        'Đơn không còn chờ thanh toán hoặc đã hết hạn. Vui lòng cập nhật trạng thái đơn.',
      );
    assertTripOpen(booking);
    if (!Number.isInteger(booking.totalPrice) || booking.totalPrice <= 0)
      throw new BadRequestException('Invalid booking amount');
  }

  async handleStripeWebhook(event: Stripe.Event) {
    if (event.type !== 'checkout.session.completed') return { ok: true };
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    const intent =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (
      !bookingId ||
      !isUUID(bookingId) ||
      session.mode !== 'payment' ||
      session.payment_status !== 'paid' ||
      session.currency !== 'vnd' ||
      !Number.isInteger(session.amount_total) ||
      session.amount_total! <= 0 ||
      !intent?.startsWith('pi_') ||
      !Number.isInteger(event.created) ||
      event.created <= 0
    )
      throw new BadRequestException('Invalid paid checkout session');
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const payment = await this.paymentRepo.manager.transaction(
      async (manager) => {
        // Serializes duplicate delivery, including legacy sessions whose payment row was overwritten.
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `stripe-session:${session.id}`,
        ]);
        let payment = await manager.findOne(Payment, {
          where: { orderId: session.id },
          relations: ['booking'],
        });
        if (!payment && session.metadata?.paymentId) {
          if (!isUUID(session.metadata.paymentId))
            throw new BadRequestException('Invalid payment ID');
          payment = await manager.findOne(Payment, {
            where: { id: session.metadata.paymentId },
            relations: ['booking'],
          });
          if (
            !payment ||
            (payment.orderId !== `checkout-${payment.id}` &&
              payment.orderId !== session.id)
          )
            throw new BadRequestException('Checkout does not match payment');
        }
        if (
          payment &&
          (payment.booking.id !== bookingId ||
            payment.provider !== PaymentProvider.STRIPE)
        )
          throw new BadRequestException('Payment belongs to another booking');
        if (payment) {
          payment = await manager.findOneOrFail(Payment, {
            where: { id: payment.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (
            [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED].includes(
              payment.status,
            )
          )
            return payment;
        }
        return manager.save(Payment, {
          id: payment?.id,
          booking,
          provider: PaymentProvider.STRIPE,
          status: PaymentStatus.SUCCESS,
          amount: session.amount_total!,
          orderId: session.id,
          stripePaymentIntentId: intent,
          paidAt: new Date(event.created * 1000),
          raw: event,
          message:
            payment && payment.amount !== session.amount_total
              ? 'AMOUNT_MISMATCH'
              : event.type,
        });
      },
    );
    if (payment.status === PaymentStatus.REFUNDED) return { ok: true };
    try {
      if (payment.message === 'AMOUNT_MISMATCH')
        throw new BadRequestException(
          'Checkout amount differs from the reserved payment',
        );
      if (
        booking.status === BookingStatus.CANCELLED ||
        booking.trip.status === TripStatus.CANCELLED
      )
        throw new BadRequestException('Booking or trip was cancelled');
      await this.bookingsService.confirmPaidBooking(bookingId, {
        paidAmount: session.amount_total!,
        paymentId: payment.id,
      });
    } catch (error) {
      // Only definitive business failures warrant compensation. Infrastructure failures are retried.
      if (
        !(error instanceof BadRequestException) &&
        !(error instanceof ConflictException)
      )
        throw error;
      this.logger.warn(
        `Cannot confirm payment ${payment.id}: ${error.message}`,
      );
      await this.bookingsService.cancelUnconfirmedBooking(bookingId);
      await this.refundSuccessfulPayment(
        payment,
        'Automatic refund: booking cannot accept this payment',
      );
      return { ok: true, refunded: true };
    }
    return { ok: true };
  }

  private async refundSuccessfulPayment(payment: Payment, reason: string) {
    const result = await this.refunds.refund(payment.id, {
      requestId: `automatic-refund-${payment.id}`,
      reason,
      method: RefundMethod.GATEWAY,
    });
    if (result.pending || result.payment.pendingRefund?.status === 'FAILED')
      throw new ServiceUnavailableException(
        'Refund has not completed; request is saved for reconciliation',
      );
    return result.changed;
  }

  async refundSuccessfulPaymentsForTrip(tripId: number, reason: string) {
    const payments = await this.paymentRepo.find({
      where: {
        booking: { trip: { id: tripId } },
        status: In([PaymentStatus.SUCCESS, PaymentStatus.REFUNDED]),
      },
    });
    let refunded = 0,
      alreadyRefunded = 0;
    const failures: Array<{ paymentId: string; message: string }> = [];
    for (const payment of payments) {
      try {
        if (
          payment.status === PaymentStatus.REFUNDED ||
          !(await this.refundSuccessfulPayment(payment, reason))
        )
          alreadyRefunded++;
        else refunded++;
      } catch (error) {
        failures.push({
          paymentId: payment.id,
          message: error instanceof Error ? error.message : 'Refund failed',
        });
      }
    }
    return { refunded, alreadyRefunded, failures };
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { name: 'expire-stripe-checkouts' })
  async expireInvalidCheckouts() {
    const payments = await this.paymentRepo.find({
      where: { status: In([PaymentStatus.INIT, PaymentStatus.PENDING]) },
      relations: ['booking', 'booking.trip'],
    });
    for (const payment of payments) {
      const booking = payment.booking;
      const holdIsActive =
        booking.status === BookingStatus.PENDING &&
        booking.expiresAt &&
        booking.expiresAt.getTime() > Date.now() &&
        [TripStatus.SCHEDULED, TripStatus.DELAYED].includes(
          booking.trip.status,
        );
      try {
        let sessionId = payment.orderId;
        if (!sessionId.startsWith('cs_')) {
          // Recover a session whose creation response was lost before persisting its ID.
          const created = await this.createOrRecoverCheckout(payment, booking);
          sessionId = created.sessionId;
          await this.paymentRepo.update(
            { id: payment.id, status: PaymentStatus.INIT },
            { orderId: sessionId, status: PaymentStatus.PENDING },
          );
        }
        let session =
          await this.stripeService.retrieveCheckoutSession(sessionId);
        if (session.status === 'open') {
          // Check paid sessions even during the hold, but never close an
          // unpaid session while the customer still has time to pay.
          if (holdIsActive) continue;
          await this.stripeService.expireCheckoutSession(sessionId);
          session = await this.stripeService.retrieveCheckoutSession(sessionId);
        }
        if (session.status === 'complete') {
          const event = await this.stripeService.findCompletedCheckoutEvent(
            sessionId,
            payment.createdAt,
          );
          if (event) await this.handleStripeWebhook(event);
          continue; // Keep the database reservation until paid status has been resolved.
        }
        if (session.status !== 'expired') continue;
        await this.paymentRepo.update(
          { id: payment.id, status: PaymentStatus.PENDING },
          { status: PaymentStatus.FAILED },
        );
        await this.bookingsService.expireUnpaidCheckout(booking.id);
      } catch (error) {
        this.logger.warn(
          `Cannot reconcile checkout ${payment.orderId}: ${error}`,
        );
      }
    }
  }
}
