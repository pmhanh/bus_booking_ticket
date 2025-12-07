import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Booking } from './booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Trip } from '../trips/trip.entity';
import { SeatLock } from '../trips/seat-lock.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BookingsService {
  private mailer?: nodemailer.Transporter;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(SeatLock)
    private readonly seatLockRepo: Repository<SeatLock>,
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    private readonly configService: ConfigService,
  ) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
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
  ) {
    const locks = await this.seatLockRepo.find({
      where: { trip: { id: tripId }, seatCode: In(seats), expiresAt: MoreThan(new Date()) },
    });
    const conflictingLocks = locks.filter((l) => l.lockToken !== lockToken);
    if (conflictingLocks.length)
      throw new BadRequestException('Seats are currently locked by another user');

    const activeBookings = await this.bookingRepo.find({
      where: [
        { trip: { id: tripId }, status: 'CONFIRMED' },
        {
          trip: { id: tripId },
          status: 'PENDING',
          expiresAt: MoreThan(new Date()),
        },
      ],
    });
    const booked = new Set(
      activeBookings.flatMap((b) => b.seats.map((s) => s.trim())),
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
    return saved;
  }

  private assertCanModify(booking: Booking, userId?: string) {
    if (booking.userId && userId && booking.userId === userId) return;
    if (!userId) return;
    if (booking.userId && booking.userId !== userId)
      throw new ForbiddenException('Booking belongs to another user');
  }

  async getByReference(reference: string) {
    await this.expireOldBookings();
    const booking = await this.bookingRepo.findOne({ where: { reference } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'PENDING' && booking.expiresAt && booking.expiresAt < new Date()) {
      booking.status = 'EXPIRED';
      await this.bookingRepo.save(booking);
    }
    return booking;
  }

  async lookup(dto: LookupBookingDto) {
    const booking = await this.getByReference(dto.reference);
    if (
      (dto.email && booking.contactEmail === dto.email) ||
      (dto.phone && dto.phone === booking.contactPhone)
    ) {
      return booking;
    }
    throw new ForbiddenException('Contact information does not match booking');
  }

  async confirm(reference: string, userId?: string) {
    const booking = await this.getByReference(reference);
    this.assertCanModify(booking, userId);
    if (booking.status === 'CONFIRMED') return booking;
    if (booking.status === 'EXPIRED')
      throw new BadRequestException('Booking already expired');
    booking.status = 'CONFIRMED';
    booking.expiresAt = null;
    return this.bookingRepo.save(booking);
  }

  async cancel(reference: string, userId?: string) {
    const booking = await this.getByReference(reference);
    this.assertCanModify(booking, userId);
    booking.status = 'CANCELLED';
    return this.bookingRepo.save(booking);
  }

  async ticketContent(reference: string) {
    const booking = await this.getByReference(reference);
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

  async sendTicket(reference: string) {
    const { booking, content } = await this.ticketContent(reference);
    if (booking.status !== 'CONFIRMED')
      throw new BadRequestException('Ticket only available for confirmed bookings');
    if (!this.mailer)
      throw new BadRequestException('Email service not configured');
    await this.mailer.sendMail({
      to: booking.contactEmail,
      subject: `E-ticket for booking ${booking.reference}`,
      text: content,
    });
    return { ok: true };
  }
}
