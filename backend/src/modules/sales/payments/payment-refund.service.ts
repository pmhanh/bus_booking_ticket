import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import {
  Payment,
  PaymentStatus,
  RefundMethod,
  RefundAttempt,
} from './entities/payment.entity';
import { StripeService } from './stripe/stripe.service';

type RefundRequest = {
  requestId: string;
  amount?: number;
  reason: string;
  method: RefundMethod;
};

@Injectable()
export class PaymentRefundService {
  private readonly logger = new Logger(PaymentRefundService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly stripe: StripeService,
  ) {}

  // Only database work here: callers can atomically cancel a booking and reserve its refund.
  async reserve(
    manager: EntityManager,
    paymentId: string,
    request: RefundRequest,
  ) {
    const payment = await manager.findOne(Payment, {
      where: { id: paymentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const previous =
      (payment.refundHistory ?? []).find(
        (r) => r.requestId === request.requestId,
      ) ??
      (payment.pendingRefund?.requestId === request.requestId
        ? payment.pendingRefund
        : undefined);
    if (previous) {
      if (
        (request.amount !== undefined && previous.amount !== request.amount) ||
        previous.method !== request.method ||
        previous.reason !== request.reason.trim()
      )
        throw new ConflictException(
          'Refund request ID was already used with different parameters',
        );
      if (previous.status === 'FAILED')
        throw new BadRequestException(
          'Refund failed; submit a new request after reviewing the failure',
        );
      return payment;
    }
    if (payment.status === PaymentStatus.REFUNDED) return payment;
    if (![PaymentStatus.SUCCESS].includes(payment.status))
      throw new BadRequestException('Only successful payments can be refunded');
    if (payment.pendingRefund?.status === 'PENDING')
      throw new ConflictException('Another refund is still pending');
    const remaining = payment.amount - (payment.refundAmount ?? 0);
    const amount = request.amount ?? remaining;
    if (
      !request.requestId ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      amount !== remaining
    )
      throw new BadRequestException('Invalid refund amount or request ID');
    if (!request.reason.trim())
      throw new BadRequestException('Refund reason is required');
    if (![RefundMethod.GATEWAY, RefundMethod.MANUAL].includes(request.method))
      throw new BadRequestException('Invalid refund method');
    if (
      request.method === RefundMethod.GATEWAY &&
      !payment.stripePaymentIntentId?.startsWith('pi_')
    )
      throw new BadRequestException('Missing Stripe payment intent');
    payment.pendingRefund = {
      ...request,
      amount,
      reason: request.reason.trim(),
      status: 'PENDING',
    };
    return manager.save(Payment, payment);
  }

  async refund(paymentId: string, request: RefundRequest) {
    await this.dataSource.transaction((manager) =>
      this.reserve(manager, paymentId, request),
    );
    return this.execute(paymentId, request.requestId);
  }

  async execute(paymentId: string, requestId?: string) {
    const snapshot = await this.dataSource.manager.findOneByOrFail(Payment, {
      id: paymentId,
    });
    const attempt = snapshot.pendingRefund;
    if (
      !attempt ||
      attempt.status !== 'PENDING' ||
      (requestId && attempt.requestId !== requestId)
    )
      return { payment: snapshot, changed: false, pending: false };
    let result: RefundAttempt = { ...attempt, status: 'SUCCEEDED' };
    try {
      if (attempt.method === RefundMethod.GATEWAY) {
        const refund = await this.stripe.refundPaymentIntent({
          paymentIntentId: snapshot.stripePaymentIntentId!,
          amount: attempt.amount,
          idempotencyKey: attempt.requestId,
          stripeRefundId: attempt.stripeRefundId,
        });
        result = {
          ...attempt,
          stripeRefundId: refund.id,
          status:
            refund.status === 'succeeded'
              ? 'SUCCEEDED'
              : ['failed', 'canceled'].includes(refund.status ?? '')
                ? 'FAILED'
                : 'PENDING',
          error: refund.failure_reason ?? undefined,
        };
      }
    } catch (error) {
      // Keep the durable request for retries; never assume a timeout means Stripe did nothing.
      result = {
        ...attempt,
        error:
          error instanceof Error ? error.message : 'Refund gateway unavailable',
      };
      this.logger.warn(`Refund ${attempt.requestId}: ${result.error}`);
    }
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOneOrFail(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        payment.pendingRefund?.requestId !== attempt.requestId ||
        payment.pendingRefund.status !== 'PENDING'
      )
        return {
          payment,
          changed: false,
          pending: payment.pendingRefund?.status === 'PENDING',
        };
      if (result.status === 'SUCCEEDED') {
        payment.refundAmount = (payment.refundAmount ?? 0) + result.amount;
        payment.status = PaymentStatus.REFUNDED;
        payment.refundReason = result.reason;
        payment.refundMethod = result.method;
        payment.refundedAt = new Date();
        payment.refundHistory = [...(payment.refundHistory ?? []), result];
        payment.pendingRefund = null;
      } else {
        // A stale pending response must not erase an ID saved by another worker.
        payment.pendingRefund = {
          ...result,
          stripeRefundId:
            result.stripeRefundId ?? payment.pendingRefund.stripeRefundId,
        };
        if (result.status === 'FAILED')
          payment.refundHistory = [...(payment.refundHistory ?? []), result];
      }
      await manager.save(Payment, payment);
      return {
        payment,
        changed: result.status === 'SUCCEEDED',
        pending: result.status === 'PENDING',
      };
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'retry-pending-refunds' })
  async retryPendingRefunds() {
    const payments = await this.dataSource.manager
      .getRepository(Payment)
      .createQueryBuilder('payment')
      .where("payment.pendingRefund ->> 'status' = :status", {
        status: 'PENDING',
      })
      .getMany();
    for (const payment of payments) {
      try {
        await this.execute(payment.id);
      } catch (error) {
        this.logger.error(
          `Could not reconcile refund for ${payment.id}`,
          error,
        );
      }
    }
  }
}
