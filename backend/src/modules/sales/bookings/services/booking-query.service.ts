import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { EntityManager, Repository } from 'typeorm';
import { normalizeEmail } from '../../../../core/utils/email.util';
import { Trip } from '../../../inventory/trips/trip.entity';
import { Payment, PaymentStatus } from '../../payments/entities/payment.entity';
import { Booking } from '../entities/booking.entity';
import {
  getVietnamDateRange,
  parseVietnamDateStart,
} from '../../../../core/utils/date.util';
import { ListBookingsDto, LookupBookingDto } from '../dto/booking.dto';

@Injectable()
export class BookingQueryService {
  constructor(
    @InjectRepository(Booking) private readonly repo: Repository<Booking>,
  ) {}

  async generateReference(manager: EntityManager) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt++) {
      const reference = Array.from(
        { length: 8 },
        () => alphabet[randomInt(alphabet.length)],
      ).join('');
      // Reserve the code until the caller commits the booking in this transaction.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `booking-reference:${reference}`,
      ]);
      const existing = await manager.findOne(Booking, { where: { reference } });
      if (!existing) return reference;
    }
    throw new ServiceUnavailableException(
      'Could not generate booking reference',
    );
  }

  private query(manager: EntityManager = this.repo.manager) {
    return manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .innerJoinAndSelect('booking.trip', 'trip')
      .innerJoinAndSelect('trip.route', 'route')
      .innerJoinAndSelect('route.originCity', 'originCity')
      .innerJoinAndSelect('route.destinationCity', 'destinationCity')
      .innerJoinAndSelect('trip.bus', 'bus')
      .leftJoinAndSelect('booking.pickupStop', 'pickupStop')
      .leftJoinAndSelect('pickupStop.city', 'pickupCity')
      .leftJoinAndSelect('booking.dropoffStop', 'dropoffStop')
      .leftJoinAndSelect('dropoffStop.city', 'dropoffCity')
      .leftJoinAndSelect('booking.details', 'details')
      .leftJoinAndSelect('details.tripSeat', 'tripSeat');
  }

  async find(code: string, manager?: EntityManager) {
    const value = code.trim();
    const booking = await this.query(manager)
      .where(
        isUUID(value) ? 'booking.id = :value' : 'booking.reference = :value',
        {
          value: isUUID(value) ? value : value.toUpperCase(),
        },
      )
      .orderBy('details.id', 'ASC')
      .getOne();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async lockTrip(manager: EntityManager, tripId: number) {
    const trip = await manager.findOne(Trip, {
      where: { id: tripId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async findForUpdate(code: string, manager: EntityManager) {
    const initial = await this.find(code, manager);
    // All booking mutations lock trip first, then booking, including trip cancellation.
    await this.lockTrip(manager, initial.trip.id);
    const booking = await this.query(manager)
      .where('booking.id = :id', { id: initial.id })
      .orderBy('details.id', 'ASC')
      .setLock('pessimistic_write', undefined, ['booking'])
      .getOne();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  listForUser(userId: string) {
    return this.query()
      .where('booking.user_id = :userId', { userId })
      .orderBy('booking.createdAt', 'DESC')
      .getMany();
  }

  async lookup(dto: LookupBookingDto) {
    if (!dto.email && !dto.phone)
      throw new BadRequestException('Provide tripDate with phone or email');
    const { start, endExclusive } = getVietnamDateRange(dto.tripDate);
    const qb = this.query()
      .where('booking.user_id IS NULL')
      .andWhere(
        'trip.departureTime >= :start AND trip.departureTime < :endExclusive',
        { start, endExclusive },
      );
    if (dto.email)
      qb.andWhere('LOWER(TRIM(booking.contactEmail)) = :email', {
        email: normalizeEmail(dto.email),
      });
    if (dto.phone)
      qb.andWhere('TRIM(booking.contactPhone) = :phone', {
        phone: dto.phone.trim(),
      });
    const limit = 20;
    const [data, total] = await qb
      .orderBy('booking.createdAt', 'DESC')
      .take(limit)
      .getManyAndCount();
    if (!data.length) throw new NotFoundException('Booking not found');
    return { data, total, limit };
  }

  async listForAdmin(params: ListBookingsDto) {
    const from = params.fromDate
      ? parseVietnamDateStart(params.fromDate)
      : undefined;
    const to = params.toDate ? getVietnamDateRange(params.toDate) : undefined;
    if (from && to && from > to.start)
      throw new BadRequestException('fromDate must not be after toDate');
    const qb = this.query();
    if (params.status)
      qb.andWhere('booking.status = :status', { status: params.status });
    if (params.tripId)
      qb.andWhere('trip.id = :tripId', { tripId: params.tripId });
    if (params.routeId)
      qb.andWhere('route.id = :routeId', { routeId: params.routeId });
    if (from) qb.andWhere('trip.departureTime >= :from', { from });
    if (to) qb.andWhere('trip.departureTime < :to', { to: to.endExclusive });
    if (params.search)
      qb.andWhere(
        '(booking.contactName ILIKE :search OR booking.contactEmail ILIKE :search OR booking.reference ILIKE :search)',
        { search: `%${params.search}%` },
      );
    const [data, total] = await qb
      .orderBy('booking.createdAt', 'DESC')
      .addOrderBy('booking.id', 'ASC')
      .take(params.limit)
      .skip(params.offset)
      .getManyAndCount();
    return { data, total, limit: params.limit, offset: params.offset };
  }

  async getAdminBooking(code: string) {
    const booking = await this.find(code);
    const payments = await this.repo.manager.find(Payment, {
      where: { booking: { id: booking.id } },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    const payment =
      payments.find((p) => [PaymentStatus.SUCCESS].includes(p.status)) ??
      payments[0] ??
      null;
    return { ...booking, payment, payments };
  }
}
