import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
} from 'typeorm';
import { normalizeEmail } from '../../../core/utils/email.util';
import { SeatGateway } from '../../../infrastructure/realtime/seat.gateway';
import { SeatLockService } from '../../../infrastructure/redis/seat-lock.service';
import { RouteStop, RouteStopType } from '../../fleet/routes/route-stop.entity';
import { SeatValidationService } from '../../inventory/trip-seats/seat-validation.service';
import { TripSeat } from '../../inventory/trip-seats/trip-seat.entity';
import {
  Payment,
  PaymentStatus,
  RefundMethod,
} from '../payments/entities/payment.entity';
import { PaymentRefundService } from '../payments/payment-refund.service';
import { BookingDetail } from './entities/booking-detail.entity';
import { BookingQueryService } from './services/booking-query.service';
import { BookingTicketService } from './services/booking-ticket.service';
import {
  assertBookingAccess,
  assertBookingEditable,
  assertTripOpen,
  BookingAccess,
  bookingSeatCodes,
  isBookingExpired,
} from './utils/booking.utils';
import { Booking, BookingStatus } from './entities/booking.entity';
import {
  CreateBookingDto,
  ListBookingsDto,
  LookupBookingDto,
  ProcessRefundDto,
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly queries: BookingQueryService,
    private readonly tickets: BookingTicketService,
    private readonly seatLocks: SeatLockService,
    private readonly seatGateway: SeatGateway,
    private readonly seatValidation: SeatValidationService,
    private readonly refunds: PaymentRefundService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'expire-pending-bookings' })
  expirePendingBookings() {
    return this.dataSource.manager.update(
      Booking,
      {
        status: BookingStatus.PENDING,
        checkoutExpiresAt: IsNull(),
        expiresAt: LessThanOrEqual(new Date()),
      },
      { status: BookingStatus.EXPIRED },
    );
  }

  // Caller already holds the trip and booking locks. Retries never extend the deadline.
  async startPaymentHold(manager: EntityManager, booking: Booking) {
    if (booking.checkoutExpiresAt) return;
    const details = await manager.find(BookingDetail, {
      where: { booking: { id: booking.id } },
      relations: ['tripSeat'],
    });
    const codes = details.map((detail) => detail.seatCodeSnapshot);
    if (!codes.length || !booking.lockToken)
      throw new BadRequestException('Booking has no seat hold');
    const deadline = new Date(Date.now() + 15 * 60 * 1000);
    const reserved = await manager
      .getRepository(TripSeat)
      .createQueryBuilder()
      .update(TripSeat)
      .set({ checkoutBookingId: booking.id })
      .where('id IN (:...ids)', { ids: details.map((d) => d.tripSeat.id) })
      .andWhere('isBooked = false')
      .andWhere(
        '("checkoutBookingId" IS NULL OR "checkoutBookingId" = :bookingId)',
        { bookingId: booking.id },
      )
      .execute();
    if (reserved.affected !== details.length)
      throw new ConflictException('Seats are no longer available');
    await this.seatLocks.extendOwnedLocks(
      booking.trip.id,
      codes,
      booking.lockToken,
      deadline,
    );
    booking.expiresAt = deadline;
    booking.checkoutExpiresAt = deadline;
    await manager.update(Booking, booking.id, {
      expiresAt: deadline,
      checkoutExpiresAt: deadline,
    });
    this.seatGateway.emitSeatHeld(
      booking.trip.id,
      codes,
      deadline.toISOString(),
    );
  }

  async expireUnpaidCheckout(id: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const booking = await this.queries.findForUpdate(id, manager);
      if (booking.status !== BookingStatus.PENDING)
        return { booking, changed: false };
      const paid = await manager.exists(Payment, {
        where: { booking: { id }, status: PaymentStatus.SUCCESS },
      });
      if (paid) return { booking, changed: false };
      await manager.update(
        TripSeat,
        { checkoutBookingId: id },
        { checkoutBookingId: null },
      );
      await manager.update(Booking, id, { status: BookingStatus.EXPIRED });
      booking.status = BookingStatus.EXPIRED;
      return { booking, changed: true };
    });
    if (result.changed) await this.notifySeatChange(result.booking);
  }

  listForUser(userId: string) {
    return this.queries.listForUser(userId);
  }
  lookup(dto: LookupBookingDto) {
    return this.queries.lookup(dto);
  }
  listForAdmin(dto: ListBookingsDto) {
    return this.queries.listForAdmin(dto);
  }
  getAdminBooking(code: string) {
    return this.queries.getAdminBooking(code);
  }

  async getBooking(code: string, access: BookingAccess = {}) {
    const booking = await this.queries.find(code);
    assertBookingAccess(booking, access);
    return booking;
  }

  async create(dto: CreateBookingDto, userId?: string) {
    const seatCodes = dto.passengers.map((p) => p.seatCode.trim());
    if (
      !seatCodes.length ||
      seatCodes.some((code) => !code) ||
      new Set(seatCodes).size !== seatCodes.length
    ) {
      throw new BadRequestException(
        'Passengers must have distinct, non-empty seat codes',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      await this.queries.lockTrip(manager, dto.tripId);
      const repo = manager.getRepository(Booking);
      // The trip lock serializes duplicate requests without changing the existing schema.
      const existing = await repo.findOne({
        where: { trip: { id: dto.tripId }, lockToken: dto.lockToken },
      });
      if (existing) {
        const booking = await this.queries.find(existing.id, manager);
        assertBookingAccess(booking, {
          userId,
          contactEmail: dto.contactEmail,
        });
        const existingCodes = bookingSeatCodes(booking);
        if (
          existingCodes.length !== seatCodes.length ||
          seatCodes.some((code) => !existingCodes.includes(code))
        ) {
          throw new ConflictException(
            'This seat hold already has a different booking',
          );
        }
        // A retry returns the original booking; editing uses PATCH, not POST.
        return { ok: true, booking };
      }
      const { trip, tripSeats } =
        await this.seatValidation.validateSeatsForBooking(
          dto.tripId,
          seatCodes,
          manager,
        );
      const stops = await this.validateStops(manager, trip.route.id, dto);
      const reference = await this.queries.generateReference(manager);
      const expiresAt = await this.seatLocks.assertOwnedLocks(
        dto.tripId,
        seatCodes,
        dto.lockToken,
      );
      const booking = repo.create({
        trip,
        user: userId ? { id: userId } : null,
        reference,
        status: BookingStatus.PENDING,
        lockToken: dto.lockToken,
        expiresAt,
        contactName: dto.contactName.trim(),
        contactEmail: normalizeEmail(dto.contactEmail),
        contactPhone: dto.contactPhone?.trim(),
        ...stops,
        totalPrice: trip.basePrice * tripSeats.length,
      });
      await repo.save(booking);
      const seatsByCode = new Map(
        tripSeats.map((seat) => [seat.seatCodeSnapshot, seat]),
      );
      const details = dto.passengers.map((passenger, index) =>
        manager.create(BookingDetail, {
          booking,
          tripSeat: seatsByCode.get(seatCodes[index])!,
          seatCodeSnapshot: seatCodes[index],
          priceSnapshot: trip.basePrice,
          passengerName: passenger.name.trim(),
          passengerPhone: passenger.phone?.trim(),
          passengerIdNumber: passenger.idNumber?.trim(),
        }),
      );
      await manager.save(BookingDetail, details);
      return {
        ok: true,
        booking: await this.queries.find(booking.id, manager),
      };
    });
  }

  private async validateStops(
    manager: EntityManager,
    routeId: number,
    dto: CreateBookingDto,
  ) {
    const ids = [dto.pickupStopId, dto.dropoffStopId].filter(
      (id): id is number => id != null,
    );
    const stops = ids.length
      ? await manager.find(RouteStop, {
          where: { id: In(ids), route: { id: routeId } },
        })
      : [];
    const select = (id: number | undefined, type: RouteStopType) => {
      if (id == null) return null;
      const stop = stops.find((stop) => stop.id === id && stop.type === type);
      if (!stop)
        throw new BadRequestException(
          `Invalid ${type.toLowerCase()} stop for this trip`,
        );
      return stop;
    };
    const pickupStop = select(dto.pickupStopId, RouteStopType.PICKUP);
    const dropoffStop = select(dto.dropoffStopId, RouteStopType.DROPOFF);
    if (pickupStop && dropoffStop && pickupStop.order >= dropoffStop.order) {
      throw new BadRequestException('Pickup stop must be before dropoff stop');
    }
    return { pickupStop, dropoffStop };
  }

  async updateBooking(code: string, dto: UpdateBookingDto, userId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const booking = await this.queries.findForUpdate(code, manager);
      assertBookingAccess(booking, {
        userId,
        contactEmail: dto.verificationEmail,
        contactPhone: dto.verificationPhone,
      });
      assertBookingEditable(booking);
      if (dto.contactName !== undefined)
        booking.contactName = dto.contactName.trim();
      if (dto.contactEmail !== undefined)
        booking.contactEmail = normalizeEmail(dto.contactEmail);
      if (dto.contactPhone !== undefined)
        booking.contactPhone = dto.contactPhone.trim();
      if (dto.passengers !== undefined) {
        const codes = new Set<string>();
        for (const passenger of dto.passengers) {
          const detail = booking.details.find(
            (detail) => detail.seatCodeSnapshot === passenger.seatCode,
          );
          if (!detail || codes.has(passenger.seatCode))
            throw new BadRequestException(
              'Invalid or duplicate passenger seat',
            );
          if (detail.checkedInAt)
            throw new BadRequestException('Cannot edit a checked-in passenger');
          codes.add(passenger.seatCode);
          detail.passengerName = passenger.name;
          if (passenger.phone !== undefined)
            detail.passengerPhone = passenger.phone;
          if (passenger.idNumber !== undefined)
            detail.passengerIdNumber = passenger.idNumber;
          const result = await manager.update(
            BookingDetail,
            { id: detail.id, checkedInAt: IsNull() },
            {
              passengerName: detail.passengerName,
              passengerPhone: detail.passengerPhone,
              passengerIdNumber: detail.passengerIdNumber,
            },
          );
          if (result.affected !== 1)
            throw new ConflictException(
              'Passenger was checked in while editing',
            );
        }
      }
      await manager.update(Booking, booking.id, {
        contactName: booking.contactName,
        contactEmail: booking.contactEmail,
        contactPhone: booking.contactPhone,
      });
      return this.queries.find(booking.id, manager);
    });
  }

  async cancel(code: string, access: BookingAccess = {}, pendingOnly = false) {
    const result = await this.dataSource.transaction(async (manager) => {
      const booking = await this.queries.findForUpdate(code, manager);
      assertBookingAccess(booking, access);
      if (pendingOnly && booking.status === BookingStatus.CONFIRMED) {
        throw new BadRequestException(
          'Đơn đã được xác nhận. Vui lòng quản lý vé trong danh sách đơn đặt.',
        );
      }
      if (!pendingOnly && booking.status !== BookingStatus.CANCELLED) {
        if (isBookingExpired(booking))
          throw new BadRequestException('Booking expired');
        if (
          booking.trip.departureTime.getTime() - Date.now() <
          3 * 60 * 60 * 1000
        )
          throw new BadRequestException(
            'Cancellation requires at least 3 hours before departure',
          );
      }
      const payments = await manager.find(Payment, {
        where: {
          booking: { id: booking.id },
          status: In([PaymentStatus.SUCCESS]),
        },
      });
      if (pendingOnly && payments.length) {
        throw new BadRequestException(
          'Đơn đã thanh toán. Không thể dùng chức năng chọn lại ghế.',
        );
      }
      for (const payment of payments) {
        await this.refunds.reserve(manager, payment.id, {
          requestId: `customer-cancel-${payment.id}`,
          reason: 'Customer cancelled booking',
          method: RefundMethod.GATEWAY,
        });
      }
      return { ...(await this.cancelWithManager(manager, booking)), payments };
    });
    if (result.changed) await this.notifySeatChange(result.booking);
    let refundPending = false;
    for (const payment of result.payments) {
      try {
        const refund = await this.refunds.execute(
          payment.id,
          `customer-cancel-${payment.id}`,
        );
        refundPending ||=
          refund.pending || refund.payment.pendingRefund?.status === 'FAILED';
      } catch (error) {
        refundPending = true;
        this.logger.error(
          `Refund queued for cancelled booking ${result.booking.id}`,
          error,
        );
      }
    }
    return { ...result.booking, refundPending };
  }

  async cancelUnconfirmedBooking(id: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const booking = await this.queries.findForUpdate(id, manager);
      if (
        booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.CANCELLED
      )
        return { booking, changed: false };
      return this.cancelWithManager(manager, booking);
    });
    if (result.changed) await this.notifySeatChange(result.booking);
  }

  async updateAdminStatus(code: string, dto: UpdateBookingStatusDto) {
    if (dto.status === BookingStatus.CONFIRMED)
      return this.confirmBooking(code);
    if (dto.status !== BookingStatus.CANCELLED)
      throw new BadRequestException(
        'Admin can only confirm or cancel bookings',
      );
    const result = await this.dataSource.transaction(async (manager) => {
      const booking = await this.queries.findForUpdate(code, manager);
      return this.cancelWithManager(manager, booking);
    });
    if (result.changed) await this.notifySeatChange(result.booking);
    return result.booking;
  }

  private async cancelWithManager(manager: EntityManager, booking: Booking) {
    if (booking.status === BookingStatus.CANCELLED)
      return { booking, changed: false };
    await manager.update(
      TripSeat,
      { checkoutBookingId: booking.id },
      { checkoutBookingId: null },
    );
    const wasConfirmed = booking.status === BookingStatus.CONFIRMED;
    booking.status = BookingStatus.CANCELLED;
    booking.expiresAt = null;
    await manager.update(Booking, booking.id, {
      status: booking.status,
      expiresAt: null,
    });
    // PENDING/EXPIRED bookings never own sold seats. Historical details are not ownership.
    if (wasConfirmed && booking.details.length) {
      const ids = booking.details.map((detail) => detail.tripSeat.id);
      await manager
        .getRepository(TripSeat)
        .createQueryBuilder()
        .update(TripSeat)
        .set({ isBooked: false, bookedAt: null })
        .where('id IN (:...ids)', { ids })
        .andWhere(
          `NOT EXISTS (
          SELECT 1 FROM booking_details detail JOIN bookings other ON other.id = detail.booking_id
          WHERE detail.trip_seat_id = trip_seats.id AND other.status = :confirmed AND other.id <> :bookingId
        )`,
          { confirmed: BookingStatus.CONFIRMED, bookingId: booking.id },
        )
        .execute();
    }
    return { booking, changed: true };
  }

  // The caller holds the trip lock and owns the surrounding transaction.
  async cancelTripBookings(manager: EntityManager, tripId: number) {
    const active = await manager.find(Booking, {
      where: {
        trip: { id: tripId },
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
      },
      order: { id: 'ASC' },
    });
    const bookings: Booking[] = [];
    for (const item of active) {
      const booking = await this.queries.findForUpdate(item.id, manager);
      const result = await this.cancelWithManager(manager, booking);
      if (result.changed) bookings.push(result.booking);
    }
    return bookings;
  }

  private async confirmBooking(
    code: string,
    paidAmount?: number,
    paymentId?: string,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const booking = await this.queries.findForUpdate(code, manager);
      if (paidAmount !== undefined && paidAmount !== booking.totalPrice)
        throw new BadRequestException('Paid amount mismatch');
      if (paymentId) {
        const payment = await manager.findOne(Payment, {
          where: { id: paymentId, booking: { id: booking.id } },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !payment ||
          payment.status !== PaymentStatus.SUCCESS ||
          payment.pendingRefund ||
          payment.amount !== paidAmount ||
          (booking.checkoutExpiresAt &&
            (!payment.paidAt ||
              payment.paidAt.getTime() > booking.checkoutExpiresAt.getTime()))
        )
          throw new BadRequestException(
            'Payment is not available for booking confirmation',
          );
        if (booking.paidPaymentId && booking.paidPaymentId !== paymentId)
          throw new ConflictException('Booking was paid by another payment');
      }
      if (booking.status === BookingStatus.CONFIRMED) {
        if (paymentId && !booking.paidPaymentId) {
          const first = await manager.findOne(Payment, {
            where: {
              booking: { id: booking.id },
              status: PaymentStatus.SUCCESS,
            },
            order: { createdAt: 'ASC', id: 'ASC' },
          });
          if (first?.id !== paymentId)
            throw new ConflictException('Booking was paid by another payment');
          await manager.update(Booking, booking.id, {
            paidPaymentId: paymentId,
          });
        }
        return { booking, changed: false, expired: false };
      }
      if (booking.status === BookingStatus.CANCELLED)
        throw new BadRequestException('Booking was cancelled');
      if (!paymentId && isBookingExpired(booking)) {
        await manager.update(Booking, booking.id, {
          status: BookingStatus.EXPIRED,
        });
        return { booking, changed: false, expired: true };
      }
      const codes = bookingSeatCodes(booking);
      if (!codes.length) throw new BadRequestException('Booking has no seats');
      if (!paymentId) {
        assertTripOpen(booking);
        if (!booking.lockToken || !booking.expiresAt)
          throw new BadRequestException('Booking has no valid seat hold');
        await this.seatValidation.validateSeatsForBooking(
          booking.trip.id,
          codes,
          manager,
          booking.id,
        );
        await this.seatLocks.assertOwnedLocks(
          booking.trip.id,
          codes,
          booking.lockToken,
        );
      } else {
        // Stripe's payment time decides eligibility, not webhook delivery time or Redis TTL.
        if (booking.trip.status === 'CANCELLED')
          throw new BadRequestException('Trip was cancelled');
        if (
          booking.checkoutExpiresAt &&
          booking.details.some(
            (detail) => detail.tripSeat.checkoutBookingId !== booking.id,
          )
        )
          throw new ConflictException('Checkout no longer owns these seats');
      }
      const ids = booking.details.map((detail) => detail.tripSeat.id);
      const updated = await manager
        .getRepository(TripSeat)
        .createQueryBuilder()
        .update(TripSeat)
        .set({ isBooked: true, bookedAt: new Date(), checkoutBookingId: null })
        .where('id IN (:...ids)', { ids })
        .andWhere('isBooked = false')
        .execute();
      if (updated.affected !== ids.length)
        throw new ConflictException('Some seats are already booked');
      booking.reference ??= await this.queries.generateReference(manager);
      booking.status = BookingStatus.CONFIRMED;
      booking.expiresAt = null;
      await manager.update(Booking, booking.id, {
        reference: booking.reference,
        paidPaymentId: paymentId ?? null,
        status: booking.status,
        expiresAt: null,
      });
      return {
        booking: await this.queries.find(booking.id, manager),
        changed: true,
        expired: false,
      };
    });
    if (result.expired) throw new BadRequestException('Booking expired');
    if (result.changed) {
      await this.notifySeatChange(result.booking);
      void this.tickets.trySend(result.booking);
    }
    return result.booking;
  }

  confirmPaidBooking(
    bookingId: string,
    payment: { paidAmount: number; paymentId: string },
  ) {
    return this.confirmBooking(
      bookingId,
      payment.paidAmount,
      payment.paymentId,
    );
  }

  async processRefund(code: string, dto: ProcessRefundDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const booking = await this.queries.findForUpdate(code, manager);
      const payments = await manager.find(Payment, {
        where: {
          booking: { id: booking.id },
          status: In([PaymentStatus.SUCCESS, PaymentStatus.REFUNDED]),
        },
        order: { createdAt: 'DESC' },
      });
      const payment =
        payments.find((p) => p.id === booking.paidPaymentId) ??
        (payments.length === 1 ? payments[0] : undefined);
      if (!payment)
        throw new BadRequestException('Cannot determine the payment to refund');
      await this.refunds.reserve(manager, payment.id, dto);
      return {
        paymentId: payment.id,
        ...(await this.cancelWithManager(manager, booking)),
      };
    });
    if (result.changed) await this.notifySeatChange(result.booking);
    const refund = await this.refunds.execute(result.paymentId, dto.requestId);
    if (refund.pending || refund.payment.pendingRefund?.status === 'FAILED')
      throw new ServiceUnavailableException(
        'Booking cancelled; refund has not completed. Its status is saved for review/retry.',
      );
    return {
      ok: true,
      message: 'Refund processed successfully',
      refund: {
        amount: refund.payment.refundAmount,
        method: refund.payment.refundMethod,
        processedAt: refund.payment.refundedAt,
      },
    };
  }

  // Publish current availability after commit, not a guessed status from an old booking.
  async notifySeatChange(booking: Booking) {
    try {
      const codes = bookingSeatCodes(booking);
      if (!codes.length) return;
      if (booking.lockToken)
        await this.seatLocks.unlockSeats(
          booking.trip.id,
          codes,
          booking.lockToken,
        );
      const locks = await this.seatLocks.getLockTokens(booking.trip.id, codes);
      const seats = await this.dataSource.manager.find(TripSeat, {
        where: { trip: { id: booking.trip.id }, seatCodeSnapshot: In(codes) },
      });
      this.seatGateway.emitChanges(
        booking.trip.id,
        seats.map((seat) => ({
          seatCode: seat.seatCodeSnapshot,
          status: seat.isBooked
            ? 'booked'
            : seat.checkoutBookingId || locks.get(seat.seatCodeSnapshot)
              ? 'held'
              : 'released',
        })),
      );
    } catch (error) {
      // Notification failures must not turn a committed payment into a failed confirmation.
      this.logger.warn(
        `Could not publish booking ${booking.id}: ${String(error)}`,
      );
    }
  }

  async ticketContent(code: string, access: BookingAccess = {}) {
    return this.tickets.content(await this.getBooking(code, access));
  }

  async sendTicket(code: string, access: BookingAccess = {}) {
    return this.tickets.send(await this.getBooking(code, access));
  }
}
