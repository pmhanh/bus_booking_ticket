import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  LessThan,
  MoreThan,
  Not,
  Repository,
} from 'typeorm';
import { Trip, TripStatus } from './trip.entity';
import {
  getVietnamDateRange,
  parseVietnamDateStart,
} from '../../../core/utils/date.util';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { SearchTripsDto } from './dto/search-trips.dto';
import { Route } from '../../fleet/routes/route.entity';
import { Bus } from '../../fleet/buses/bus.entity';
import { TripSeat } from '../trip-seats/trip-seat.entity';
import { BookingDetail } from '../../sales/bookings/entities/booking-detail.entity';
import { getRealTripStatus } from './trip-status.util';
import { ListTripsDto } from './dto/list-trips.dto';
import { BookingsService } from '../../sales/bookings/bookings.service';
import { PaymentsService } from '../../sales/payments/payments.service';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { SeatLockService } from '../../../infrastructure/redis/seat-lock.service';
import {
  Booking,
  BookingStatus,
} from '../../sales/bookings/entities/booking.entity';
import {
  Payment,
  PaymentStatus,
} from '../../sales/payments/entities/payment.entity';
import { checkInBlockedReason } from './trip-check-in.util';
import { SeatDefinition } from '../../fleet/seat-maps/seat-definition.entity';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class TripsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
    @InjectRepository(BookingDetail)
    private readonly bookingDetailRepo: Repository<BookingDetail>,
    private readonly paymentsService: PaymentsService,
    private readonly bookingsService: BookingsService,
    private readonly mailService: MailService,
    private readonly seatLocks: SeatLockService,
  ) {}

  private assertValidTimeRange(departureTime: Date, arrivalTime: Date) {
    if (departureTime >= arrivalTime)
      throw new BadRequestException('Departure must be before arrival');
  }

  private async assertNoBusConflict(
    busId: number,
    departureTime: Date,
    arrivalTime: Date,
    ignoreTripId?: number,
    repository: Repository<Trip> = this.tripRepo,
  ) {
    const conflict = await repository.findOne({
      where: {
        ...(ignoreTripId ? { id: Not(ignoreTripId) } : {}),
        bus: { id: busId },
        status: Not(TripStatus.CANCELLED),
        departureTime: LessThan(arrivalTime),
        arrivalTime: MoreThan(departureTime),
      },
    });

    if (conflict)
      throw new BadRequestException(
        'Schedule conflict: bus is already assigned to another trip.',
      );
  }

  private parseTimeToMinutes(value?: string) {
    if (!value) return undefined;
    // The search slider uses 24:00 as the end-of-day boundary, not 00:00.
    if (value === '24:00') return 1440;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new BadRequestException(
        'Giờ lọc không hợp lệ. Nhập theo định dạng HH:mm từ 00:00 đến 23:59, hoặc 24:00 để chỉ cuối ngày.',
      );
    }
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  }

  private computeDurationMinutes(trip: Trip) {
    return Math.round(
      (trip.arrivalTime.getTime() - trip.departureTime.getTime()) / 60000,
    );
  }

  private serializeTrip<T extends Trip>(trip: T, now = new Date()) {
    return {
      ...trip,
      realStatus: getRealTripStatus(trip, now),
    };
  }

  async create(dto: CreateTripDto) {
    const route = await this.routeRepo.findOneBy({ id: dto.routeId });
    if (!route) throw new NotFoundException('Route not found');
    if (!route.isActive) throw new BadRequestException('Route is inactive');

    const bus = await this.busRepo.findOne({
      where: { id: dto.busId },
      relations: ['seatMap', 'seatMap.seats'],
    });
    if (!bus) throw new NotFoundException('Bus not found');
    if (!bus.isActive) throw new BadRequestException('Bus is inactive');
    if (!bus.seatMap?.id) throw new BadRequestException('Bus has no seat map');

    this.assertValidTimeRange(dto.departureTime, dto.arrivalTime);
    if (dto.departureTime <= new Date()) {
      throw new BadRequestException('Departure time must be in the future');
    }
    if (
      dto.status &&
      ![TripStatus.SCHEDULED, TripStatus.DELAYED].includes(dto.status)
    ) {
      throw new BadRequestException('A new trip must be SCHEDULED or DELAYED');
    }

    const activeSeats = bus.seatMap.seats.filter((seat) => seat.isActive);
    if (!activeSeats.length) {
      throw new BadRequestException('Bus seat map has no active seats');
    }

    await this.assertNoBusConflict(bus.id, dto.departureTime, dto.arrivalTime);

    return this.tripRepo.manager.transaction(async (manager) => {
      const tripRepo = manager.getRepository(Trip);
      const trip = tripRepo.create({
        route,
        bus,
        departureTime: dto.departureTime,
        arrivalTime: dto.arrivalTime,
        basePrice: dto.basePrice,
        status: dto.status ?? TripStatus.SCHEDULED,
      } as DeepPartial<Trip>);
      const savedTrip = await tripRepo.save(trip);

      await this.createSeatSnapshot(manager, savedTrip, activeSeats);
      return savedTrip;
    });
  }

  private createSeatSnapshot(
    manager: EntityManager,
    trip: Trip,
    seats: SeatDefinition[],
  ) {
    const repo = manager.getRepository(TripSeat);
    return repo.save(
      seats
        .filter((seat) => seat.isActive)
        .map((seat) =>
          repo.create({
            trip,
            seat,
            seatCodeSnapshot: seat.code,
            isBooked: false,
            bookedAt: null,
            checkoutBookingId: null,
          }),
        ),
    );
  }

  async list(filter: ListTripsDto = {}) {
    const qb = this.tripRepo
      .createQueryBuilder('trip')
      .select('trip.id', 'id')
      .innerJoin('trip.route', 'route')
      .innerJoin('route.originCity', 'originCity')
      .innerJoin('route.destinationCity', 'destinationCity')
      .innerJoin('trip.bus', 'bus');

    if (filter?.routeId)
      qb.andWhere('route.id = :rid', { rid: filter.routeId });
    if (filter?.busId) qb.andWhere('bus.id = :bid', { bid: filter.busId });
    if (filter.originCityId) {
      qb.andWhere('originCity.id = :originCityId', {
        originCityId: filter.originCityId,
      });
    }
    if (filter.destinationCityId) {
      qb.andWhere('destinationCity.id = :destinationCityId', {
        destinationCityId: filter.destinationCityId,
      });
    }
    if (filter?.status)
      qb.andWhere('trip.status = :status', { status: filter.status });

    const from = filter.fromDate
      ? parseVietnamDateStart(filter.fromDate)
      : undefined;
    const toExclusive = filter.toDate
      ? parseVietnamDateStart(filter.toDate)
      : undefined;
    if (toExclusive) {
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    }
    if (from && toExclusive && from >= toExclusive) {
      throw new BadRequestException(
        'fromDate must be before or equal to toDate',
      );
    }
    if (from) qb.andWhere('trip.departureTime >= :from', { from });
    if (toExclusive) {
      qb.andWhere('trip.departureTime < :toExclusive', { toExclusive });
    }

    if (filter?.sortBy === 'bookings') {
      qb.leftJoin('trip.bookings', 'booking')
        .groupBy('trip.id')
        .orderBy('COUNT(booking.id)', 'DESC');
    }
    qb.addOrderBy('trip.departureTime', 'DESC');

    if (filter?.limit) qb.limit(filter.limit);
    if (filter?.offset) qb.offset(filter.offset);

    const rawIds = await qb.getRawMany<{ id: number }>();
    if (!rawIds.length) return [];
    const ids = rawIds.map((r) => r.id);

    // Phase 2: Join lấy đầy đủ thông tin chỉ cho các ID đã lọc
    const trips = await this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('route.originCity', 'originCity')
      .leftJoinAndSelect('route.destinationCity', 'destinationCity')
      .leftJoinAndSelect('trip.bus', 'bus')
      .where('trip.id IN (:...ids)', { ids })
      .getMany();

    const tripMap = new Map(trips.map((t) => [t.id, t]));
    const now = new Date();
    return ids.map((id) => this.serializeTrip(tripMap.get(id)!, now));
  }

  async searchPublic(params: SearchTripsDto) {
    const qb = this.tripRepo
      .createQueryBuilder('trip')
      .innerJoin('trip.route', 'route')
      .innerJoin('route.originCity', 'originCity')
      .innerJoin('route.destinationCity', 'destinationCity')
      .innerJoin('trip.bus', 'bus')
      .where('trip.status IN (:...statuses)', {
        statuses: [TripStatus.SCHEDULED, TripStatus.DELAYED],
      })
      .andWhere('route.isActive = true')
      .andWhere('bus.isActive = true')
      .andWhere('trip.departureTime > :now', { now: new Date() });

    if (params.originId) {
      qb.andWhere('originCity.id = :originId', { originId: params.originId });
    }
    if (params.destinationId) {
      qb.andWhere('destinationCity.id = :destinationId', {
        destinationId: params.destinationId,
      });
    }

    const dateRange = params.date
      ? getVietnamDateRange(params.date)
      : undefined;
    if (dateRange) {
      qb.andWhere(
        'trip.departureTime >= :start AND trip.departureTime < :end',
        { start: dateRange.start, end: dateRange.endExclusive },
      );
    }

    const startMin = this.parseTimeToMinutes(params.startTime);
    const endMin = this.parseTimeToMinutes(params.endTime);
    if (startMin !== undefined) {
      qb.andWhere(
        `(EXTRACT(HOUR FROM trip.departureTime AT TIME ZONE '${VIETNAM_TIME_ZONE}') * 60 + EXTRACT(MINUTE FROM trip.departureTime AT TIME ZONE '${VIETNAM_TIME_ZONE}')) >= :startMin`,
        { startMin },
      );
    }
    if (endMin !== undefined) {
      qb.andWhere(
        `(EXTRACT(HOUR FROM trip.departureTime AT TIME ZONE '${VIETNAM_TIME_ZONE}') * 60 + EXTRACT(MINUTE FROM trip.departureTime AT TIME ZONE '${VIETNAM_TIME_ZONE}')) <= :endMin`,
        { endMin },
      );
    }

    if (params.minPrice !== undefined)
      qb.andWhere('trip.basePrice >= :minPrice', { minPrice: params.minPrice });
    if (params.maxPrice !== undefined)
      qb.andWhere('trip.basePrice <= :maxPrice', { maxPrice: params.maxPrice });
    if (params.busType)
      qb.andWhere('bus.busType = :busType', { busType: params.busType });
    if (params.amenities?.length)
      qb.andWhere('bus.amenities @> :amenities::text[]', {
        amenities: params.amenities,
      });

    // Sắp xếp
    const sortOrder =
      params.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    if (params.sortBy === 'price') {
      qb.orderBy('trip.basePrice', sortOrder);
    } else if (params.sortBy === 'duration') {
      qb.orderBy(
        'EXTRACT(EPOCH FROM (trip.arrivalTime - trip.departureTime))',
        sortOrder,
      );
    } else {
      qb.orderBy('trip.departureTime', sortOrder);
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const idsQb = qb
      .clone()
      .select('trip.id', 'id')
      .offset((page - 1) * limit)
      .limit(limit);

    const [rawIds, total] = await Promise.all([
      idsQb.getRawMany<{ id: number }>(),
      qb.clone().getCount(),
    ]);

    if (!rawIds.length) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const ids = rawIds.map((r) => r.id);

    const trips = await this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('route.originCity', 'originCity')
      .leftJoinAndSelect('route.destinationCity', 'destinationCity')
      .leftJoinAndSelect('trip.bus', 'bus')
      .leftJoinAndSelect('bus.seatMap', 'seatMap')
      .where('trip.id IN (:...ids)', { ids })
      .getMany();

    const tripMap = new Map(trips.map((t) => [t.id, t]));
    const now = new Date();

    return {
      data: ids.map((id) => {
        const trip = tripMap.get(id)!;
        return {
          ...this.serializeTrip(trip, now),
          durationMinutes: this.computeDurationMinutes(trip),
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPublicById(id: number) {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: [
        'route',
        'route.originCity',
        'route.destinationCity',
        'route.stops',
        'route.stops.city',
        'bus',
        'bus.seatMap',
      ],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return {
      ...this.serializeTrip(trip),
      durationMinutes: this.computeDurationMinutes(trip),
    };
  }

  async update(id: number, dto: UpdateTripDto) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Trip);
      // Use the same trip lock as booking creation and temporary seat holds.
      const lockedTrip = await repo
        .createQueryBuilder('trip')
        .where('trip.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!lockedTrip) throw new NotFoundException('Trip not found');
      const trip = await repo.findOne({
        where: { id },
        relations: ['bus'],
      });
      if (!trip) throw new NotFoundException('Trip not found');

      if (dto.routeId) {
        const route = await manager.getRepository(Route).findOne({
          where: { id: dto.routeId },
        });
        if (!route) throw new NotFoundException('Route not found');
        trip.route = route;
      }

      const changingBus = dto.busId !== undefined && dto.busId !== trip.bus.id;
      if (changingBus) {
        const hasBooking = await manager
          .getRepository(Booking)
          .existsBy({ trip: { id } });
        if (hasBooking) {
          throw new ConflictException(
            'Không thể đổi xe vì chuyến đã có khách đặt vé.',
          );
        }
        const seats = await manager
          .getRepository(TripSeat)
          .find({ where: { trip: { id } } });
        if (seats.some((seat) => seat.isBooked || seat.checkoutBookingId)) {
          throw new ConflictException(
            'Không thể đổi xe vì chuyến đã có ghế được đặt.',
          );
        }
        const locks = await this.seatLocks.getLockTokens(
          id,
          seats.map((seat) => seat.seatCodeSnapshot),
        );
        if ([...locks.values()].some(Boolean)) {
          throw new ConflictException(
            'Chuyến đang có khách giữ ghế. Vui lòng chờ hết thời gian giữ ghế trước khi đổi xe.',
          );
        }
        const bus = await manager.getRepository(Bus).findOne({
          where: { id: dto.busId },
          relations: ['seatMap', 'seatMap.seats'],
        });
        if (!bus) throw new NotFoundException('Không tìm thấy xe.');
        if (!bus.isActive)
          throw new BadRequestException('Xe đã ngừng hoạt động.');
        if (!bus.seatMap?.seats.some((seat) => seat.isActive)) {
          throw new BadRequestException(
            'Xe chưa có sơ đồ ghế với ghế đang hoạt động.',
          );
        }
        trip.bus = bus;
      }

      const departureTime = dto.departureTime ?? trip.departureTime;
      const arrivalTime = dto.arrivalTime ?? trip.arrivalTime;
      this.assertValidTimeRange(departureTime, arrivalTime);
      await this.assertNoBusConflict(
        trip.bus.id,
        departureTime,
        arrivalTime,
        trip.id,
        repo,
      );

      trip.departureTime = departureTime;
      trip.arrivalTime = arrivalTime;
      if (dto.basePrice !== undefined) trip.basePrice = dto.basePrice;
      if (dto.status) trip.status = dto.status;
      const savedTrip = await repo.save(trip);
      if (changingBus) {
        const seatsRepo = manager.getRepository(TripSeat);
        await seatsRepo.delete({ trip: { id } });
        await this.createSeatSnapshot(
          manager,
          savedTrip,
          trip.bus.seatMap.seats,
        );
      }
      return savedTrip;
    });
  }

  async cancel(id: number) {
    const cancellation = await this.dataSource.transaction(async (manager) => {
      const trip = await manager
        .getRepository(Trip)
        .createQueryBuilder('trip')
        .where('trip.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!trip) throw new NotFoundException('Trip not found');
      if (trip.status === TripStatus.COMPLETED) {
        throw new BadRequestException('Completed trip cannot be cancelled');
      }

      if (trip.status !== TripStatus.CANCELLED) {
        trip.status = TripStatus.CANCELLED;
        await manager.save(trip);
      }

      const bookings = await this.bookingsService.cancelTripBookings(
        manager,
        id,
      );

      return { trip, bookings };
    });

    const releasedSeatCodes = new Set<string>();
    for (const booking of cancellation.bookings) {
      const seatCodes = (booking.details ?? []).map(
        (detail) => detail.seatCodeSnapshot,
      );
      seatCodes.forEach((seatCode) => releasedSeatCodes.add(seatCode));

      await this.bookingsService.notifySeatChange(booking);

      if (booking.contactEmail) {
        await this.mailService.sendMail({
          to: booking.contactEmail,
          subject: `Trip ${id} has been cancelled`,
          text: `Your booking ${booking.reference || booking.id} was cancelled because trip ${id} was cancelled. Any successful online payment will be refunded.`,
          html: `<p>Your booking <strong>${booking.reference || booking.id}</strong> was cancelled because trip ${id} was cancelled.</p><p>Any successful online payment will be refunded.</p>`,
          errorLabel: `trip cancellation ${id}`,
        });
      }
    }

    const refunds = await this.paymentsService.refundSuccessfulPaymentsForTrip(
      id,
      `Automatic refund because trip ${id} was cancelled`,
    );

    return {
      ok: refunds.failures.length === 0,
      message:
        refunds.failures.length === 0
          ? 'Trip cancelled successfully'
          : 'Trip cancelled, but some refunds require retry',
      affectedBookings: cancellation.bookings.length,
      releasedSeats: releasedSeatCodes.size,
      refunds,
    };
  }

  async delete(id: number) {
    const trip = await this.tripRepo.findOne({ where: { id }, select: ['id'] });
    if (!trip) throw new NotFoundException('Trip not found');

    const hasBookings = await this.bookingDetailRepo.exists({
      where: {
        tripSeat: { trip: { id } },
      },
    });
    if (hasBookings) {
      throw new BadRequestException(
        'Cannot delete trip with existing bookings',
      );
    }

    await this.tripRepo.delete(id);
    return { ok: true };
  }

  private eligiblePassengers(
    tripId: number,
    repository = this.bookingDetailRepo,
  ) {
    return repository
      .createQueryBuilder('detail')
      .innerJoinAndSelect('detail.booking', 'booking')
      .innerJoin(
        Payment,
        'payment',
        'payment.id = booking.paidPaymentId AND payment.booking_id = booking.id',
      )
      .where('booking.trip_id = :tripId', { tripId })
      .andWhere('booking.status = :bookingStatus', {
        bookingStatus: BookingStatus.CONFIRMED,
      })
      .andWhere('payment.status = :paymentStatus', {
        paymentStatus: PaymentStatus.SUCCESS,
      })
      .andWhere('payment.amount = booking.totalPrice')
      .andWhere('COALESCE(payment.refundAmount, 0) = 0')
      .andWhere('payment.refundedAt IS NULL')
      .andWhere('payment.pendingRefund IS NULL');
  }

  async getPassengers(tripId: number) {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['route', 'route.originCity', 'route.destinationCity'],
    });
    if (!trip) throw new NotFoundException('Trip not found');

    const bookingDetails = await this.eligiblePassengers(tripId)
      .orderBy('detail.seatCodeSnapshot', 'ASC')
      .getMany();

    return {
      trip: {
        id: trip.id,
        route: trip.route,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        status: trip.status,
        realStatus: getRealTripStatus(trip),
        checkInBlockedReason: checkInBlockedReason(trip),
      },
      passengers: bookingDetails.map((bd) => ({
        bookingDetailId: bd.id,
        bookingReference: bd.booking.reference,
        bookingStatus: bd.booking.status,
        seatCode: bd.seatCodeSnapshot,
        passengerName: bd.passengerName,
        passengerPhone: bd.passengerPhone,
        passengerIdNumber: bd.passengerIdNumber,
        checkedInAt: bd.checkedInAt,
        isCheckedIn: !!bd.checkedInAt,
      })),
    };
  }

  async checkInPassenger(
    tripId: number,
    bookingDetailId: number,
    undo = false,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const trip = await manager.findOne(Trip, {
        where: { id: tripId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!trip) throw new NotFoundException('Không tìm thấy chuyến xe.');
      const blocked = checkInBlockedReason(trip);
      if (blocked) throw new BadRequestException(blocked);
      const initial = await manager.findOne(BookingDetail, {
        where: { id: bookingDetailId },
        relations: ['booking', 'booking.trip'],
      });
      if (!initial || initial.booking.trip.id !== tripId)
        throw new NotFoundException(
          'Không tìm thấy hành khách trong chuyến xe.',
        );
      const booking = await manager.findOneOrFail(Booking, {
        where: { id: initial.booking.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (booking.paidPaymentId)
        await manager.findOne(Payment, {
          where: { id: booking.paidPaymentId },
          lock: { mode: 'pessimistic_write' },
        });
      const bookingDetail = await this.eligiblePassengers(
        tripId,
        manager.getRepository(BookingDetail),
      )
        .andWhere('detail.id = :detailId', { detailId: bookingDetailId })
        .setLock('pessimistic_write', undefined, ['detail'])
        .getOne();
      if (!bookingDetail)
        throw new BadRequestException(
          'Chỉ được thao tác với đơn đã xác nhận, thanh toán đủ và chưa có yêu cầu hoàn tiền.',
        );
      const checkedInAt = undo
        ? null
        : (bookingDetail.checkedInAt ?? new Date());
      await manager.update(BookingDetail, bookingDetail.id, { checkedInAt });
      return {
        ok: true,
        bookingDetailId: bookingDetail.id,
        checkedInAt,
      };
    });
  }

  async updateOperationalStatus(
    tripId: number,
    status: 'DEPARTED' | 'ARRIVED',
  ) {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    if (status === 'DEPARTED') {
      trip.status = TripStatus.IN_PROGRESS;
    } else if (status === 'ARRIVED') {
      trip.status = TripStatus.COMPLETED;
    }

    await this.tripRepo.save(trip);

    return {
      ok: true,
      tripId: trip.id,
      status: trip.status,
      realStatus: getRealTripStatus(trip),
    };
  }
}
