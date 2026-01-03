import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  In,
  LessThan,
  Repository,
} from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Booking } from './booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Trip } from '../trips/trip.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { ConfigService } from '@nestjs/config';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { TripSeatsService } from '../trips/trip-seats.service';
import { BookingReferenceService } from './booking-reference.service';
import { GuestLookupDto } from './dto/guest-lookup.dto';
import { isUUID } from 'class-validator';
import { BookingDetail } from './booking-detail.entity';
import { TripSeat } from 'src/trips/trip-seat.entity';
import { SeatLockService } from 'src/redis/seat-lock.service';
import { SeatGateway } from 'src/realtime/seat.gateway';
import { RouteStop } from '../routes/route-stop.entity';

type BookingAccessOptions = {
  userId?: string;
  contactEmail?: string;
  contactPhone?: string;
  requireContactForGuest?: boolean;
  skipAccessCheck?: boolean; // internal flows (e.g., payment IPN) can bypass contact/user checks
};

@Injectable()
export class BookingsService {
  private mailer?: nodemailer.Transporter;
  private mailFrom?: string;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    private readonly tripSeatsService: TripSeatsService,
    private readonly configService: ConfigService,
    private readonly bookingRefService: BookingReferenceService,
    private readonly seatLockService: SeatLockService,
    private readonly seatGateway: SeatGateway,
  ) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpFrom = this.configService.get<string>('SMTP_FROM') || smtpUser;
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    if (smtpHost && smtpUser && smtpPass) {
      this.mailer = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.mailFrom = smtpFrom;
    }
  }

  private async getTripContext(tripId: number) {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['bus', 'bus.seatMap', 'route'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.bus?.seatMap?.id)
      throw new BadRequestException('Trip has no seat map assigned');
    const seatMap = await this.seatMapRepo.findOne({
      where: { id: trip.bus.seatMap.id },
      relations: ['seats'],
    });
    if (!seatMap) throw new NotFoundException('Seat map not found for bus');
    return { trip, seatMap };
  }

  private ensureSeatsExist(seatMap: SeatMap, seats: string[]) {
    const lookup = new Map(seatMap.seats.map((s) => [s.code, s]));
    const missing = seats.filter((s) => !lookup.get(s));
    if (missing.length)
      throw new BadRequestException(`Seats not found: ${missing.join(', ')}`);
    const inactive = seats.filter((s) => lookup.get(s)?.isActive === false);
    if (inactive.length)
      throw new BadRequestException(
        `Inactive seats cannot be booked: ${inactive.join(', ')}`,
      );
    return seats.map((s) => lookup.get(s)!);
  }

  async listForUser(userId: string) {
    await this.expireOldBookings();
    return this.bookingRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async lookup(dto: LookupBookingDto) {
    const { reference, email, phone } = dto;
    if (!reference && !email && !phone) {
      throw new BadRequestException('Provide booking reference, email, or phone');
    }
    if (reference) {
      const booking = await this.findBookingByCode(reference);
      if (!booking) throw new NotFoundException('Booking not found');
      return booking;
    }

    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.trip', 'trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('route.originCity', 'originCity')
      .leftJoinAndSelect('route.destinationCity', 'destinationCity')
      .leftJoinAndSelect('trip.bus', 'bus')
      .orderBy('booking.createdAt', 'DESC');

    if (email) qb.where('booking.contactEmail = :email', { email });
    if (phone) qb[email ? 'andWhere' : 'where']('booking.contactPhone = :phone', { phone });

    const booking = await qb.getOne();
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async lookupGuest(dto: GuestLookupDto) {
    if (dto.bookingRef) {
      if (!dto.phone && !dto.email)
        throw new BadRequestException('Phone or email is required with bookingRef');
      return this.getBooking(dto.bookingRef, {
        contactEmail: dto.email,
        contactPhone: dto.phone,
        requireContactForGuest: true,
      });
    }

    if (dto.phone && dto.tripDate) {
      const date = new Date(dto.tripDate);
      if (Number.isNaN(date.getTime()))
        throw new BadRequestException('Invalid tripDate');
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const booking = await this.bookingRepo
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.trip', 'trip')
        .leftJoinAndSelect('trip.route', 'route')
        .leftJoinAndSelect('route.originCity', 'originCity')
        .leftJoinAndSelect('route.destinationCity', 'destinationCity')
        .leftJoinAndSelect('trip.bus', 'bus')
        .where('booking.contactPhone = :phone', { phone: dto.phone })
        .andWhere('trip.departureTime BETWEEN :start AND :end', { start, end })
        .orderBy('booking.createdAt', 'DESC')
        .getOne();

      if (!booking) throw new NotFoundException('Booking not found');
      return booking;
    }

    throw new BadRequestException(
      'Provide bookingRef with phone/email or phone with tripDate',
    );
  }

  async getSeatStatus(tripId: number) {
    const availability = await this.tripSeatsService.getSeatMap(tripId);
    return {
      seatMap: availability.seatMap,
      basePrice: availability.trip.basePrice,
      seats: availability.seats.map((seat) => ({
        code: seat.code,
        row: seat.row,
        col: seat.col,
        price: seat.price ?? availability.trip.basePrice,
        isActive: seat.isActive,
        status:
          seat.status === 'booked'
            ? 'booked'
            : seat.status === 'inactive'
            ? 'inactive'
            : seat.status === 'held'
              ? 'held'
              : 'available',
      })),
    };
  }

  async sendTicket(code: string, opts: BookingAccessOptions = {}) {
    const { booking, content } = await this.ticketContent(code, opts);
    if (booking.status !== 'CONFIRMED')
      throw new BadRequestException('Ticket only available for confirmed bookings');
    if (!this.mailer)
      throw new BadRequestException('Email service not configured');
    await this.mailer.sendMail({
      from: this.mailFrom,
      to: booking.contactEmail,
      subject: `E-ticket for booking ${booking.reference}`,
      text: content,
    });
    return { ok: true };
  }

  private async expireOldBookings(tripId?: number) {
    const where = {
      status: 'PENDING',
      expiresAt: LessThan(new Date()),
      ...(tripId ? { trip: { id: tripId } } : {}),
    } as any;

    const expiring = await this.bookingRepo.find({ where });
    if (expiring.length) {
      await this.bookingRepo.update(
        { id: In(expiring.map((b) => b.id)) },
        { status: 'EXPIRED' },
      );
    }
  }

  private async findBookingByCode(code: string) {
    const booking = await this.bookingRepo.findOne({
      where: isUUID(code)
        ? [{ id: code }, { reference: code }]
        : [{ reference: code }],
      relations: [
        'trip',
        'trip.route',
        'trip.route.originCity',
        'trip.route.destinationCity',
        'trip.bus',
        'details',
        'details.tripSeat',
      ],
      order: { details: { id: 'ASC' } },
    });
    return booking;
  }

  private assertAccess(booking: Booking, opts: BookingAccessOptions = {}) {
    const { userId, contactEmail, contactPhone } = opts;
    if (booking.userId) {
      if (!userId || booking.userId !== userId) {
        throw new ForbiddenException('Booking belongs to another user');
      }
      return;
    }

    const emailMatch = contactEmail && booking.contactEmail === contactEmail;
    const phoneMatch = contactPhone && booking.contactPhone === contactPhone;
    if (!emailMatch && !phoneMatch) {
      throw new ForbiddenException('Contact information does not match booking');
    }
  }

  // ✅ CREATE: PENDING + booking_details
  async create(dto: CreateBookingDto, userId?: string) {
    const seatCodes = Array.from(new Set(dto.passengers.map((p) => p.seatCode)));
    if (!seatCodes.length) throw new BadRequestException('passengers is empty');

    // ✅ verify redis hold
    await this.seatLockService.assertOwnedLocks(dto.tripId, seatCodes, dto.lockToken);

    return this.dataSource.transaction(async (manager) => {
      const tripSeatRepo = manager.getRepository(TripSeat);
      const bookingRepo = manager.getRepository(Booking);
      const detailRepo = manager.getRepository(BookingDetail);

      // ✅ TripSeat dùng relation trip + seatCodeSnapshot
      const tripSeats = await tripSeatRepo.find({
        where: {
          trip: { id: dto.tripId },
          seatCodeSnapshot: In(seatCodes),
        } as any,
      });

      if (tripSeats.length !== seatCodes.length) {
        throw new BadRequestException('Some seatCodes are invalid');
      }

      const booked = tripSeats.find((s) => s.isBooked === true);
      if (booked) {
        throw new BadRequestException(
          `Seat already booked: ${booked.seatCodeSnapshot}`,
        );
      }

      const expiresAt = new Date(dto.holdExpiresAt);
      if (Number.isNaN(expiresAt.getTime())) throw new BadRequestException('Invalid holdExpiresAt');

      const basePrice = (await manager.getRepository(Trip)
                        .findOne({ where: { id: dto.tripId } }))!.basePrice;

      // Validate pickup/dropoff stops if provided
      let pickupStop: RouteStop | null = null;
      let dropoffStop: RouteStop | null = null;

      if (dto.pickupStopId || dto.dropoffStopId) {
        const trip = await manager.getRepository(Trip).findOne({
          where: { id: dto.tripId },
          relations: ['route', 'route.stops'],
        });
        if (!trip) throw new NotFoundException('Trip not found');

        if (dto.pickupStopId) {
          pickupStop = trip.route.stops?.find(s => s.id === dto.pickupStopId) || null;
          if (!pickupStop) {
            throw new BadRequestException('Invalid pickupStopId for this trip');
          }
          if (pickupStop.type !== 'PICKUP') {
            throw new BadRequestException('Selected stop is not a pickup point');
          }
        }

        if (dto.dropoffStopId) {
          dropoffStop = trip.route.stops?.find(s => s.id === dto.dropoffStopId) || null;
          if (!dropoffStop) {
            throw new BadRequestException('Invalid dropoffStopId for this trip');
          }
          if (dropoffStop.type !== 'DROPOFF') {
            throw new BadRequestException('Selected stop is not a dropoff point');
          }
        }
      }

      const booking = new Booking();
      (booking as any).trip = { id: dto.tripId };
      (booking as any).userId = userId ?? undefined;
      (booking as any).expiresAt = expiresAt;
      (booking as any).status = 'PENDING';
      (booking as any).lockToken = dto.lockToken;
      (booking as any).contactName = dto.contactName;
      (booking as any).contactEmail = dto.contactEmail;
      (booking as any).contactPhone = dto.contactPhone ?? undefined;
      (booking as any).pickupStop = pickupStop ? { id: dto.pickupStopId } : null;
      (booking as any).dropoffStop = dropoffStop ? { id: dto.dropoffStopId } : null;
      (booking as any).totalPrice = tripSeats.reduce(
        (sum, seat) => sum + (seat.price ?? basePrice),
        0,
      );
      const savedBooking = await bookingRepo.save(booking); // ✅ savedBooking: Booking

      // map seatCode -> TripSeat
      const seatMap = new Map(tripSeats.map((s) => [s.seatCodeSnapshot, s]));

      const details = dto.passengers.map((p) => {
        const ts = seatMap.get(p.seatCode);
        if (!ts) throw new BadRequestException(`Seat not found: ${p.seatCode}`);

        const d = new BookingDetail();
        d.booking = savedBooking;
        d.tripSeat = ts;
        d.seatCodeSnapshot = p.seatCode;
        d.priceSnapshot = ts.price ?? basePrice;
        d.passengerName = p.name;
        d.passengerPhone = p.phone ?? undefined;      // ✅ undefined, không dùng null
        d.passengerIdNumber = p.idNumber ?? undefined; // ✅ undefined, không dùng null
        return d;
      });

      await detailRepo.save(details);

      return {
        ok: true,
        booking: savedBooking,
      };
    });
  }



  async getBooking(code: string, opts: BookingAccessOptions = {}) {
    const { requireContactForGuest, skipAccessCheck, ...access } = opts;
    await this.expireOldBookings();
    const booking = await this.findBookingByCode(code);
    if (!booking) throw new NotFoundException('Booking not found');

    if (
      !skipAccessCheck &&
      (booking.userId ||
        opts.userId ||
        opts.contactEmail ||
        opts.contactPhone ||
        requireContactForGuest)
    ) {
      this.assertAccess(booking, access);
    }
    return booking;
  }

  async updateBooking(code: string, dto: UpdateBookingDto, userId?: string) {
    const booking = await this.getBooking(code, {
      userId,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      requireContactForGuest: true,
    });

    if (dto.contactName !== undefined) booking.contactName = dto.contactName;
    if (dto.contactEmail !== undefined) booking.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) booking.contactPhone = dto.contactPhone;

    return this.bookingRepo.save(booking);
  }

  async confirm(code: string, opts: BookingAccessOptions = {}) {
    // Access + load booking (đã include trip + details + tripSeat trong getBooking/findBookingByCode của bạn)
    const booking = await this.getBooking(code, { ...opts, requireContactForGuest: true });

    if (booking.status === 'CONFIRMED') return booking;
    if (booking.status === 'EXPIRED')
      throw new BadRequestException('Booking already expired');
    if (booking.status === 'CANCELLED')
      throw new BadRequestException('Booking was cancelled');

    // chuẩn bị data để unlock/broadcast sau commit
    const tripId = booking.trip?.id ?? undefined;
    const lockToken = (booking as any).lockToken as string | undefined;

    const updated = await this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const tripSeatRepo = manager.getRepository(TripSeat);

      // Reload fresh để chắc chắn nhất (avoid dirty state)
      const fresh = await bookingRepo.findOne({
        where: { id: booking.id } as any,
        relations: ['trip', 'details', 'details.tripSeat'],
        order: { details: { id: 'ASC' } } as any,
      });
      if (!fresh) throw new NotFoundException('Booking not found');

      if (fresh.status === 'CONFIRMED') return fresh;
      if (fresh.status === 'EXPIRED')
        throw new BadRequestException('Booking already expired');
      if (fresh.status === 'CANCELLED')
        throw new BadRequestException('Booking was cancelled');

      // Nếu booking có expiresAt, check lại trong confirm để chắc:
      if (fresh.expiresAt && fresh.expiresAt.getTime() < Date.now()) {
        fresh.status = 'EXPIRED';
        await bookingRepo.save(fresh);
        throw new BadRequestException('Booking expired');
      }

      // Lấy danh sách tripSeatIds
      const tripSeatIds = (fresh.details ?? [])
        .map((d) => d.tripSeat?.id)
        .filter(Boolean) as number[];
      if (!tripSeatIds.length) {
        throw new BadRequestException('Booking has no seats');
      }

      // Book seats atomically (ngăn double-book)
      const res = await tripSeatRepo
        .createQueryBuilder()
        .update(TripSeat)
        .set({ isBooked: true, bookedAt: new Date() })
        .where('id IN (:...ids)', { ids: tripSeatIds })
        .andWhere('isBooked = false')
        .execute();

      if (res.affected !== tripSeatIds.length) {
        throw new BadRequestException('Some seats already booked by another booking');
      }

      // Update booking status
      fresh.status = 'CONFIRMED';
      fresh.expiresAt = null;

      // (optional) cập nhật totalPrice nếu bạn muốn chắc chắn snapshot
      // fresh.totalPrice = fresh.details.reduce((sum, d) => sum + (d.priceSnapshot ?? 0), 0);

      await bookingRepo.save(fresh);
      return fresh;
    });

    // ---- After commit: unlock redis best-effort ----
    // seatCodes dùng snapshot trong details (ổn định)
    const seatCodes = (updated.details ?? []).map((d) => d.seatCodeSnapshot).filter(Boolean);

    if (tripId && lockToken && seatCodes.length) {
      try {
        await this.seatLockService.unlockSeats(tripId, seatCodes, lockToken);
      } catch {
        // ignore: lock có thể đã hết TTL
      }
    }

    // ---- After commit: websocket broadcast ----
    if (tripId && seatCodes.length) {
      this.seatGateway.emitSeatBooked(tripId, seatCodes);
    }

    this.trySendTicket(updated).catch(() => {});
    return updated;
  }


  async cancel(code: string, opts: BookingAccessOptions = {}) {
    const booking = await this.getBooking(code, { ...opts, requireContactForGuest: true });
    if (booking.status === 'CONFIRMED') {
      // tuỳ policy: hoàn tiền / disallow cancel
      // hiện tại cho cancel vẫn ok nhưng nhớ xử lý refund nếu có payment
    }
    booking.status = 'CANCELLED';
    return this.bookingRepo.save(booking);
  }

  async ticketContent(code: string, opts: BookingAccessOptions = {}) {
    const booking = await this.getBooking(code, { ...opts, requireContactForGuest: true });
    if (booking.status !== 'CONFIRMED')
      throw new BadRequestException('Ticket only available for confirmed bookings');

    const seatList = (booking.details ?? []).map((d) => d.seatCodeSnapshot).join(', ');

    const lines = [
      `Booking Reference: ${booking.reference}`,
      `Trip: ${booking.trip.route.originCity.name} -> ${booking.trip.route.destinationCity.name}`,
      `Departure: ${booking.trip.departureTime.toISOString()}`,
      `Seats: ${seatList}`,
      `Status: ${booking.status}`,
      `Contact: ${booking.contactName} (${booking.contactEmail})`,
    ];
    return { booking, content: lines.join('\n') };
  }

  private formatTicketContent(booking: Booking) {
    const depart = booking.trip.departureTime.toISOString();
    const arrive = booking.trip.arrivalTime.toISOString();
    const seats = (booking.details ?? []).map((d) => d.seatCodeSnapshot).join(', ');
    const lines = [
      `Booking Reference: ${booking.reference}`,
      `Status: ${booking.status}`,
      `Route: ${booking.trip.route.originCity.name} -> ${booking.trip.route.destinationCity.name}`,
      `Departure: ${depart}`,
      `Arrival: ${arrive}`,
      `Seats: ${seats}`,
      `Contact: ${booking.contactName} (${booking.contactEmail || booking.contactPhone || ''})`,
      `Total: ${booking.totalPrice.toLocaleString()} VND`,
    ];
    return lines.join('\n');
  }

  private async trySendTicket(booking: Booking) {
    if (!this.mailer) return;
    if (!booking.contactEmail) return;
    const text = this.formatTicketContent(booking);
    await this.mailer.sendMail({
      from: this.mailFrom,
      to: booking.contactEmail,
      subject: `E-ticket for booking ${booking.reference}`,
      text,
    });
  }

  // bookings.service.ts (thêm method)
async confirmPaidBooking(
  bookingId: string,
  payment: { provider: string; orderId: string; paidAmount: number; raw?: any },
) {
    // Load booking + details fresh
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId } as any,
      relations: ['trip', 'trip.route', 'trip.route.originCity', 'trip.route.destinationCity', 'details', 'details.tripSeat'],
      order: { details: { id: 'ASC' } } as any,
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status === 'CONFIRMED') return booking;
    if (booking.status === 'CANCELLED') throw new BadRequestException('Booking cancelled');
    if (booking.status === 'EXPIRED') throw new BadRequestException('Booking expired');
    if (booking.expiresAt && booking.expiresAt.getTime() < Date.now()) {
      booking.status = 'EXPIRED';
      await this.bookingRepo.save(booking);
      throw new BadRequestException('Booking expired');
    }

    // validate amount
    if (booking.totalPrice !== payment.paidAmount) {
      throw new BadRequestException('Paid amount mismatch');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const bookingRepo = manager.getRepository(Booking);
      const tripSeatRepo = manager.getRepository(TripSeat);

      const fresh = await bookingRepo.findOne({
        where: { id: booking.id } as any,
        relations: ['trip', 'details', 'details.tripSeat'],
        order: { details: { id: 'ASC' } } as any,
      });
      if (!fresh) throw new NotFoundException('Booking not found');

      if (fresh.status === 'CONFIRMED') return fresh;

      const tripSeatIds = (fresh.details ?? [])
        .map((d) => d.tripSeat?.id)
        .filter(Boolean) as number[];

      if (!tripSeatIds.length) throw new BadRequestException('Booking has no seats');

      const res = await tripSeatRepo
        .createQueryBuilder()
        .update(TripSeat)
        .set({ isBooked: true, bookedAt: new Date() })
        .where('id IN (:...ids)', { ids: tripSeatIds })
        .andWhere('isBooked = false')
        .execute();

      if (res.affected !== tripSeatIds.length) {
        throw new BadRequestException('Some seats already booked by another booking');
      }

      // generate reference ONLY HERE
      fresh.reference = await this.bookingRefService.generateUnique();
      fresh.status = 'CONFIRMED';
      fresh.expiresAt = null;

      (fresh as any).paymentProvider = payment.provider;
      (fresh as any).paymentOrderId = payment.orderId;
      (fresh as any).paymentStatus = 'PAID';
      (fresh as any).paidAt = new Date();

      await bookingRepo.save(fresh);
      return fresh;
    });

    // after commit unlock redis + websocket
    const tripId = updated.trip?.id;
    const lockToken = (updated as any).lockToken as string | undefined;
    const seatCodes = (updated.details ?? []).map((d) => d.seatCodeSnapshot).filter(Boolean);

    if (tripId && lockToken && seatCodes.length) {
      try { await this.seatLockService.unlockSeats(tripId, seatCodes, lockToken); } catch {}
    }
    if (tripId && seatCodes.length) this.seatGateway.emitSeatBooked(tripId, seatCodes);

    // gửi ticket email nếu muốn
    this.trySendTicket(updated).catch(() => {});
    return updated;
  }

}
