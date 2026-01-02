import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';

import { Payment } from './entities/payment.entity';
import { MomoConfig } from './momo/momo.config';
import { MomoCreateParams, buildCreateRawSignature, buildIpnRawSignature, hmacSHA256 } from './momo/momo.signature';
import { StripeService } from './stripe/stripe.service';

// IMPORT booking stuff (bạn sửa path theo project)
import { Booking } from '../bookings/booking.entity';
import { BookingReferenceService } from '../bookings/booking-reference.service';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly momo: MomoConfig,
    private readonly stripeService: StripeService,
    private readonly bookingRef: BookingReferenceService,
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

    const existing = await this.paymentRepo.findOne({ where: { provider: 'STRIPE', bookingId } });
    if (existing?.status === 'SUCCESS') {
      throw new BadRequestException('Booking already paid via Stripe');
    }

    const session = await this.stripeService.createCheckoutSession({
      bookingId,
      amount,
      email: email || booking.contactEmail || undefined,
    });

    await this.paymentRepo.save({
      id: existing?.id,
      bookingId: booking.id,
      provider: 'STRIPE',
      status: 'PENDING',
      amount,
      orderId: session.sessionId,
      requestId: session.sessionId,
      payUrl: session.checkoutUrl,
      raw: { session },
    });

    return {
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
    };
  }

  async createMomoPayment(bookingId: string) {
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

    // MoMo: orderId unique, avoid special chars to reduce sandbox 99 errors
    const orderId = `BK${booking.id.replace(/-/g, '')}`;
    const requestId = randomUUID();

    // extraData: base64 JSON nếu bạn muốn nhúng bookingId/userId
    const extraData = Buffer.from(JSON.stringify({ bookingId: booking.id })).toString('base64');

    const orderInfo = `Pay booking ${booking.reference || booking.id}`;

    const createBody: MomoCreateParams = {
      partnerCode: this.momo.partnerCode,
      accessKey: this.momo.accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl: this.momo.redirectUrl,
      ipnUrl: this.momo.ipnUrl,
      extraData,
      requestType: this.momo.requestType,
    };

    const rawSignature = buildCreateRawSignature(createBody);
    const signature = hmacSHA256(rawSignature, this.momo.secretKey);

    console.log('MoMo RAW=', rawSignature);
    console.log('MoMo RAW_LEN=', rawSignature.length);
    console.log('MoMo SIG=', signature);

    const body = {
      ...createBody,
      storeName: 'BusTicket One',
      storeId: 'BusTicketStore',
      lang: 'vi',
      signature,
    };
    console.log('MoMo BODY=', JSON.stringify(body));

    // Idempotent: reuse existing row to avoid UNIQUE(orderId) conflict
    const existing = await this.paymentRepo.findOne({ where: { provider: 'MOMO', orderId } });
    if (existing?.status === 'SUCCESS') {
      throw new BadRequestException('Booking already paid via MoMo');
    }

    await this.paymentRepo.save({
      id: existing?.id,
      bookingId: booking.id,
      provider: 'MOMO',
      status: 'INIT',
      amount,
      orderId,
      requestId,
      raw: { createBody: body },
    });

    const res = await fetch(this.momo.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => '');
      await this.paymentRepo.update({ orderId }, { status: 'FAILED', raw: { text } } as any);
      throw new BadRequestException('MoMo response is not JSON');
    }
    if (!res.ok || data?.resultCode !== 0) {
      await this.paymentRepo.update(
        { orderId },
        { status: 'FAILED', resultCode: data?.resultCode, message: data?.message, raw: data },
      );
      throw new BadRequestException(data?.message || 'MoMo create payment failed');
    }

    await this.paymentRepo.update(
      { orderId },
      {
        status: 'PENDING',
        payUrl: data.payUrl,
        deeplink: data.deeplink,
        qrCodeUrl: data.qrCodeUrl,
        resultCode: data.resultCode,
        message: data.message,
        raw: data,
      },
    );

    return {
      ok: true,
      orderId,
      requestId,
      payUrl: data.payUrl,
      deeplink: data.deeplink,
      qrCodeUrl: data.qrCodeUrl,
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

    const payment = await this.paymentRepo.findOne({ where: { provider: 'STRIPE', orderId: session.id } });
    if (payment?.status === 'SUCCESS') return { ok: true };

    await this.paymentRepo.save({
      id: payment?.id,
      bookingId: booking.id,
      provider: 'STRIPE',
      status: 'SUCCESS',
      amount: amountPaid,
      orderId: session.id,
      requestId: session.id,
      payUrl: session.url ?? payment?.payUrl,
      resultCode: 0,
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

  verifyMomoIpnSignature(dto: any) {
    const raw = buildIpnRawSignature({
      accessKey: this.momo.accessKey,
      ...dto,
    });
    const sig = hmacSHA256(raw, this.momo.secretKey);
    return sig === dto.signature;
  }

  async handleMomoIpn(dto: any) {
    // 1) verify signature
    if (!this.verifyMomoIpnSignature(dto)) {
      throw new BadRequestException('Invalid signature');
    }

    // 2) update payment row
    const payment = await this.paymentRepo.findOne({ where: { orderId: dto.orderId } });
    if (!payment) throw new NotFoundException('Payment not found');

    // idempotent
    if (payment.status === 'SUCCESS') return { ok: true };

    const success = dto.resultCode === 0;
    await this.paymentRepo.update(
      { orderId: dto.orderId },
      {
        status: success ? 'SUCCESS' : 'FAILED',
        transId: dto.transId,
        resultCode: dto.resultCode,
        message: dto.message,
        raw: dto,
      },
    );

    if (!success) return { ok: true };

    // 3) finalize booking: generate reference + confirm seats
    // IMPORTANT: đảm bảo amount khớp booking.totalPrice
    const booking = await this.bookingRepo.findOne({ where: { id: payment.bookingId } as any });
    if (!booking) throw new NotFoundException('Booking not found');

    // dùng confirm logic sẵn có của bạn (book seat + unlock redis + emit ws)
    // confirm() của bạn đang nhận (code) có thể là reference hoặc uuid
    await this.bookingsService.confirmPaidBooking(
        booking.id,
        {
            provider: 'MOMO',
            orderId: dto.orderId,
            paidAmount: dto.amount,
            raw: dto,
        }
    );

    return { ok: true };
  }
}
