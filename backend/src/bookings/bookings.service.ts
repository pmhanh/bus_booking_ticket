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
  MoreThan,
  Not,
  Repository,
} from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Booking } from './booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Trip } from '../trips/trip.entity';
import { SeatLock } from '../trips/seat-lock.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { ConfigService } from '@nestjs/config';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { TripSeatsService } from '../trips/trip-seats.service';
import { SeatValidationService } from '../trips/seat-validation.service';
import { BookingReferenceService } from './booking-reference.service';
import { GuestLookupDto } from './dto/guest-lookup.dto';
import { isUUID } from 'class-validator';

type BookingAccessOptions = {
  userId?: string;
  contactEmail?: string;
  contactPhone?: string;
  requireContactForGuest?: boolean;
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
    @InjectRepository(SeatLock)
    private readonly seatLockRepo: Repository<SeatLock>,
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    private readonly seatValidation: SeatValidationService,
    private readonly tripSeatsService: TripSeatsService,
    private readonly configService: ConfigService,
    private readonly bookingRefService: BookingReferenceService,
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

  private async assertNoConflicts(
    tripId: number,
    seats: string[],
    lockToken?: string,
    ignoreBookingId?: string,
  ) {
    const locks = await this.seatLockRepo.find({
      where: {
        trip: { id: tripId },
        seatCode: In(seats),
        status: 'ACTIVE',
        expiresAt: MoreThan(new Date()),
      },
    });
    const conflictingLocks = locks.filter((l) => l.lockToken !== lockToken);
    if (conflictingLocks.length)
      throw new BadRequestException('Seats are currently locked by another user');

    const activeBookings = await this.bookingRepo.find({
      where: [
        {
          trip: { id: tripId },
          status: 'CONFIRMED',
          ...(ignoreBookingId ? { id: Not(ignoreBookingId) } : {}),
        },
        {
          trip: { id: tripId },
          status: 'PENDING',
          expiresAt: MoreThan(new Date()),
          ...(ignoreBookingId ? { id: Not(ignoreBookingId) } : {}),
        },
      ],
    });
    const booked = new Set(
      activeBookings
        .filter((b) => (ignoreBookingId ? b.id !== ignoreBookingId : true))
        .flatMap((b) => b.seats.map((s) => s.trim())),
    );
    const bookedConflicts = seats.filter((s) => booked.has(s));
    if (bookedConflicts.length)
      throw new BadRequestException(
        `Seats already booked: ${bookedConflicts.join(', ')}`,
      );
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
      ],
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

  private async assertLockOwnership(
    tripId: number,
    seats: string[],
    lockToken?: string,
    userId?: string,
    guestSessionId?: string,
  ) {
    if (!lockToken) throw new BadRequestException('lockToken is required');
    const locks = await this.seatLockRepo.find({
      where: {
        trip: { id: tripId },
        lockToken,
        status: 'ACTIVE',
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!locks.length)
      throw new BadRequestException('Lock not found or already expired');
    const owner = locks[0];
    if (owner.userId && userId && owner.userId !== userId)
      throw new ForbiddenException('Lock belongs to another user');
    if (
      owner.guestSessionId &&
      guestSessionId &&
      owner.guestSessionId !== guestSessionId
    )
      throw new ForbiddenException('Lock belongs to another guest');
    const lockedSeats = new Set(locks.map((l) => l.seatCode));
    const missing = seats.filter((s) => !lockedSeats.has(s));
    if (missing.length)
      throw new BadRequestException(
        `Lock does not cover seats: ${missing.join(', ')}`,
      );
  }

  async create(dto: CreateBookingDto, userId?: string) {
    if (!dto.lockToken)
      throw new BadRequestException('lockToken is required to create booking');
    await this.expireOldBookings(dto.tripId);
    const seats = Array.from(new Set(dto.seats.map((s) => s.trim())));
    if (!seats.length) throw new BadRequestException('Seats are required');
    await this.assertLockOwnership(
      dto.tripId,
      seats,
      dto.lockToken,
      userId,
      dto.guestSessionId,
    );
    const saved = await this.dataSource.transaction(async (manager) => {
      const { trip, seats: seatEntities } =
        await this.seatValidation.validateSeatsForBooking(
          dto.tripId,
          seats,
          dto.lockToken,
          userId,
          dto.guestSessionId,
          manager,
        );
      const totalPrice = seatEntities.reduce(
        (sum, seat) => sum + (seat.price || trip.basePrice),
        0,
      );
      const reference = await this.bookingRefService.generateUnique();
      const bookingRepo = manager.getRepository(Booking);
      const booking = bookingRepo.create({
        reference,
        trip,
        seats,
        userId,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        passengers: dto.passengers,
        totalPrice,
        status: 'CONFIRMED',
        expiresAt: null,
      });
      const persisted = await bookingRepo.save(booking);
      await manager.update(
        SeatLock,
        {
          trip: { id: trip.id },
          lockToken: dto.lockToken,
          status: 'ACTIVE',
          expiresAt: MoreThan(new Date()),
        },
        { status: 'USED' },
      );
      return persisted;
    });

    this.trySendTicket(saved).catch(() => {
      /* best-effort */
    });
    return saved;
  }

  async getBooking(code: string, opts: BookingAccessOptions = {}) {
    const { requireContactForGuest, ...access } = opts;
    await this.expireOldBookings();
    const booking = await this.findBookingByCode(code);
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'PENDING' && booking.expiresAt && booking.expiresAt < new Date()) {
      booking.status = 'EXPIRED';
      await this.bookingRepo.save(booking);
    }
    if (
      booking.userId ||
      opts.userId ||
      opts.contactEmail ||
      opts.contactPhone ||
      requireContactForGuest
    ) {
      this.assertAccess(booking, access);
    }
    return booking;
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

  async getSeatStatus(tripId: number, lockToken?: string) {
    const availability = await this.tripSeatsService.getSeatMap(tripId, lockToken);
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
            : seat.status === 'locked'
              ? 'locked'
              : seat.status === 'held'
                ? 'reserved'
                : seat.isActive
                  ? 'available'
                  : 'booked',
      })),
    };
  }

  async updateBooking(code: string, dto: UpdateBookingDto, userId?: string) {
    const booking = await this.getBooking(code, {
      userId,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      requireContactForGuest: true,
    });
    const { trip } = await this.getTripContext(booking.trip.id);
    const currentSeats = booking.seats.slice();
    if (dto.seats) {
      const seats = Array.from(new Set(dto.seats.map((s) => s.trim())));
      if (!seats.length) throw new BadRequestException('At least one seat is required');
      const validation = await this.seatValidation.validateSeatsForBooking(
        trip.id,
        seats,
        undefined,
        userId,
      );
      booking.seats = seats;
      booking.totalPrice = validation.seats.reduce(
        (sum, seat) => sum + (seat.price || trip.basePrice),
        0,
      );
      if (!dto.passengers) {
        const allowed = new Set(seats);
        booking.passengers = (booking.passengers || []).filter((p) =>
          p.seatCode ? allowed.has(p.seatCode) : false,
        );
      }
    }

    if (dto.passengers) {
      const seats = new Set(dto.seats ?? booking.seats ?? currentSeats);
      booking.passengers = dto.passengers
        .filter((p) => !p.seatCode || seats.has(p.seatCode))
        .map((p) => ({
          name: p.name,
          phone: p.phone,
          idNumber: p.idNumber,
          seatCode: p.seatCode,
        }));
    }

    if (dto.contactName !== undefined) booking.contactName = dto.contactName;
    if (dto.contactEmail !== undefined) booking.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) booking.contactPhone = dto.contactPhone;

    const updated = await this.bookingRepo.save(booking);
    return updated;
  }

  async confirm(code: string, opts: BookingAccessOptions = {}) {
    const booking = await this.getBooking(code, { ...opts, requireContactForGuest: true });
    if (booking.status === 'CONFIRMED') return booking;
    if (booking.status === 'EXPIRED')
      throw new BadRequestException('Booking already expired');
    booking.status = 'CONFIRMED';
    booking.expiresAt = null;
    const updated = await this.bookingRepo.save(booking);
    await this.seatLockRepo.update(
      {
        trip: { id: booking.trip.id },
        seatCode: In(booking.seats),
        status: 'ACTIVE',
      },
      { status: 'USED' },
    );
    this.trySendTicket(updated).catch((err) =>
      console.warn('Auto send ticket failed:', err?.message || err),
    );
    return updated;
  }

  async cancel(code: string, opts: BookingAccessOptions = {}) {
    const booking = await this.getBooking(code, { ...opts, requireContactForGuest: true });
    booking.status = 'CANCELLED';
    const updated = await this.bookingRepo.save(booking);
    return updated;
  }

  async ticketContent(code: string, opts: BookingAccessOptions = {}) {
    const booking = await this.getBooking(code, { ...opts, requireContactForGuest: true });
    if (booking.status === 'EXPIRED' || booking.status === 'CANCELLED')
      throw new BadRequestException('Booking is not active');
    const lines = [
      `Booking Reference: ${booking.reference}`,
      `Trip: ${booking.trip.route.originCity.name} -> ${booking.trip.route.destinationCity.name}`,
      `Departure: ${booking.trip.departureTime.toISOString()}`,
      `Seats: ${booking.seats.join(', ')}`,
      `Status: ${booking.status}`,
      `Contact: ${booking.contactName} (${booking.contactEmail})`,
    ];
    return { booking, content: lines.join('\n') };
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

  private formatTicketContent(booking: Booking) {
    const depart = booking.trip.departureTime.toISOString();
    const arrive = booking.trip.arrivalTime.toISOString();
    const lines = [
      `Booking Reference: ${booking.reference}`,
      `Status: ${booking.status}`,
      `Route: ${booking.trip.route.originCity.name} -> ${booking.trip.route.destinationCity.name}`,
      `Departure: ${depart}`,
      `Arrival: ${arrive}`,
      `Seats: ${booking.seats.join(', ')}`,
      `Contact: ${booking.contactName} (${booking.contactEmail || booking.contactPhone || ''})`,
      `Total: ${booking.totalPrice.toLocaleString()} VND`,
    ];
    return lines.join('\n');
  }

  private async trySendTicket(booking: Booking) {
    if (!this.mailer) return;
    if (!booking.contactEmail) return;
    const text = this.formatTicketContent(booking);
    const subjectPrefix =
      booking.status === 'CONFIRMED' ? 'E-ticket' : 'Booking received';
    await this.mailer.sendMail({
      from: this.mailFrom,
      to: booking.contactEmail,
      subject: `${subjectPrefix} for booking ${booking.reference}`,
      text,
    });
  }
}
