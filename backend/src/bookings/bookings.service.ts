import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Not, Repository } from 'typeorm';
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
import { TripSeatsGateway } from '../trips/trip-seats.gateway';

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
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(SeatLock)
    private readonly seatLockRepo: Repository<SeatLock>,
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    private readonly tripSeatsService: TripSeatsService,
    private readonly configService: ConfigService,
    private readonly tripSeatsGateway: TripSeatsGateway,
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
      where: { trip: { id: tripId }, seatCode: In(seats), expiresAt: MoreThan(new Date()) },
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

  private generateReference() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ref = '';
    for (let i = 0; i < 8; i++) {
      ref += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return ref;
  }

  private async uniqueReference() {
    let ref = this.generateReference();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.bookingRepo.findOne({ where: { reference: ref } });
      if (!existing) return ref;
      ref = this.generateReference();
    }
  }

  private async findBookingByCode(code: string) {
    const booking = await this.bookingRepo.findOne({
      where: [{ id: code }, { reference: code }],
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

  async create(dto: CreateBookingDto, userId?: string) {
    await this.expireOldBookings(dto.tripId);
    const { trip, seatMap } = await this.getTripContext(dto.tripId);
    const seats = Array.from(new Set(dto.seats.map((s) => s.trim())));
    if (!seats.length) throw new BadRequestException('Seats are required');
    const seatEntities = this.ensureSeatsExist(seatMap, seats);
    await this.assertNoConflicts(trip.id, seats, dto.lockToken);
    const totalPrice = seatEntities.reduce((sum, seat) => sum + (seat.price || trip.basePrice), 0);
    const reference = await this.uniqueReference();
    const expiresAt = new Date(Date.now() + 15 * 60000); // default 15 minutes
    const booking = this.bookingRepo.create({
      reference,
      trip,
      seats,
      userId,
      contactName: dto.contactName,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      passengers: dto.passengers,
      totalPrice,
      status: 'PENDING',
      expiresAt,
    });
    const saved = await this.bookingRepo.save(booking);
    await this.broadcastAvailability(trip.id);
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
      await this.broadcastAvailability(booking.trip.id);
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
    return this.getBooking(dto.reference, {
      contactEmail: dto.email,
      contactPhone: dto.phone,
    });
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
          seat.status === 'locked'
            ? 'booked'
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
    const { trip, seatMap } = await this.getTripContext(booking.trip.id);
    const currentSeats = booking.seats.slice();
    if (dto.seats) {
      const seats = Array.from(new Set(dto.seats.map((s) => s.trim())));
      if (!seats.length) throw new BadRequestException('At least one seat is required');
      this.ensureSeatsExist(seatMap, seats);
      await this.assertNoConflicts(trip.id, seats, undefined, booking.id);
      booking.seats = seats;
      const seatEntities = this.ensureSeatsExist(seatMap, seats);
      booking.totalPrice = seatEntities.reduce(
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
    await this.broadcastAvailability(booking.trip.id);
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
    await this.broadcastAvailability(booking.trip.id);
    this.trySendTicket(updated).catch((err) =>
      console.warn('Auto send ticket failed:', err?.message || err),
    );
    return updated;
  }

  async cancel(code: string, opts: BookingAccessOptions = {}) {
    const booking = await this.getBooking(code, { ...opts, requireContactForGuest: true });
    booking.status = 'CANCELLED';
    const updated = await this.bookingRepo.save(booking);
    await this.broadcastAvailability(booking.trip.id);
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

  private async trySendTicket(booking: Booking) {
    if (!this.mailer) return;
    if (!booking.contactEmail) return;
    const { content } = await this.ticketContent(booking.reference || booking.id, {
      contactEmail: booking.contactEmail,
      contactPhone: booking.contactPhone,
    });
    await this.mailer.sendMail({
      from: this.mailFrom,
      to: booking.contactEmail,
      subject: `E-ticket for booking ${booking.reference}`,
      text: content,
    });
  }

  private async broadcastAvailability(tripId: number) {
    try {
      const availability = await this.tripSeatsService.getSeatMap(tripId);
      this.tripSeatsGateway.broadcastAvailability(tripId, availability);
    } catch (err) {
      // best-effort; không chặn luồng booking vì lỗi broadcast
      // eslint-disable-next-line no-console
      console.warn('Broadcast seat availability failed:', err);
    }
  }
}
