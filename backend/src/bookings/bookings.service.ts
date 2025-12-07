import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Booking, BookingPassenger } from './booking.entity';
import { Trip } from '../trips/trip.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { User } from '../users/user.entity';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { SeatDefinition } from '../seat-maps/seat-definition.entity';

type SeatStatus = 'available' | 'reserved' | 'booked';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private generateReferenceCode(tripId: number) {
    const now = new Date();
    const day = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now
      .getDate()
      .toString()
      .padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `BK-${tripId}-${day}-${rand}`;
  }

  private ensureOwnership(
    booking: Booking,
    user?: User | null,
    contactPhone?: string,
    contactEmail?: string,
  ) {
    if (user && booking.user?.id === user.id) return;
    if (
      contactPhone &&
      booking.contactPhone &&
      booking.contactPhone.replace(/\D/g, '') === contactPhone.replace(/\D/g, '')
    )
      return;
    if (
      contactEmail &&
      booking.contactEmail &&
      booking.contactEmail.toLowerCase() === contactEmail.toLowerCase()
    )
      return;
    throw new ForbiddenException('You are not allowed to access this booking');
  }

  private buildSeatLookup(seatDefinitions?: SeatDefinition[]) {
    const lookup = new Map<string, SeatDefinition>();
    (seatDefinitions || []).forEach((seat) => lookup.set(seat.code, seat));
    return lookup;
  }

  private async normalizePassengers(
    trip: Trip,
    seats: { seatCode: string; name: string; phone?: string; idNumber?: string; price?: number }[],
    ignoreBookingId?: string,
  ): Promise<BookingPassenger[]> {
    if (!seats?.length) {
      throw new BadRequestException('At least one seat is required');
    }
    const seen = new Set<string>();
    const seatDefinitions = trip.bus?.seatMap?.seats ?? [];
    const seatLookup = this.buildSeatLookup(seatDefinitions);
    const activeBookings = await this.bookingRepo.find({
      where: { trip: { id: trip.id }, status: Not('CANCELLED') },
    });
    const occupied = new Set<string>();
    activeBookings.forEach((booking) => {
      if (ignoreBookingId && booking.id === ignoreBookingId) return;
      booking.passengers?.forEach((p) => occupied.add(p.seatCode));
    });

    return seats.map((seat) => {
      if (seen.has(seat.seatCode))
        throw new BadRequestException(`Seat ${seat.seatCode} is duplicated`);
      seen.add(seat.seatCode);
      const def = seatLookup.get(seat.seatCode);
      if (seatLookup.size && !def) {
        throw new BadRequestException(`Seat ${seat.seatCode} is not in this bus layout`);
      }
      if (def && def.isActive === false) {
        throw new BadRequestException(`Seat ${seat.seatCode} is inactive`);
      }
      if (occupied.has(seat.seatCode)) {
        throw new BadRequestException(`Seat ${seat.seatCode} is already taken`);
      }
      const price = seat.price ?? def?.price ?? trip.basePrice;
      return {
        seatCode: seat.seatCode,
        name: seat.name,
        phone: seat.phone,
        idNumber: seat.idNumber,
        price,
      };
    });
  }

  async create(dto: CreateBookingDto, user?: User | null) {
    const trip = await this.tripRepo.findOne({
      where: { id: dto.tripId },
      relations: [
        'route',
        'route.originCity',
        'route.destinationCity',
        'bus',
        'bus.seatMap',
        'bus.seatMap.seats',
      ],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    const passengers = await this.normalizePassengers(trip, dto.seats);
    const totalPrice = passengers.reduce((sum, seat) => sum + seat.price, 0);
    const booking = this.bookingRepo.create({
      referenceCode: this.generateReferenceCode(trip.id),
      trip,
      user: user ?? null,
      contactName: dto.contactName,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      passengers,
      totalPrice,
      status: 'CONFIRMED',
    });
    return this.bookingRepo.save(booking);
  }

  async listForUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.bookingRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async lookup(referenceCode: string, phone?: string, email?: string) {
    const booking = await this.bookingRepo.findOne({ where: { referenceCode } });
    if (!booking) throw new NotFoundException('Booking not found');
    this.ensureOwnership(booking, undefined, phone, email);
    return booking;
  }

  async getOne(id: string, user?: User | null, phone?: string, email?: string) {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    this.ensureOwnership(booking, user, phone, email);
    return booking;
  }

  async update(id: string, dto: UpdateBookingDto, user?: User | null) {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['trip', 'trip.bus', 'trip.bus.seatMap', 'trip.bus.seatMap.seats'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled booking');
    }
    this.ensureOwnership(booking, user, dto.contactPhone, dto.contactEmail);
    if (dto.contactName) booking.contactName = dto.contactName;
    if (dto.contactEmail) booking.contactEmail = dto.contactEmail;
    if (dto.contactPhone) booking.contactPhone = dto.contactPhone;
    if (dto.seats) {
      const passengers = await this.normalizePassengers(booking.trip, dto.seats, booking.id);
      booking.passengers = passengers;
      booking.totalPrice = passengers.reduce((sum, seat) => sum + seat.price, 0);
    }
    return this.bookingRepo.save(booking);
  }

  async cancel(id: string, dto: CancelBookingDto, user?: User | null) {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    this.ensureOwnership(booking, user, dto.contactPhone, dto.contactEmail);
    booking.status = 'CANCELLED';
    return this.bookingRepo.save(booking);
  }

  async getSeatStatusForTrip(tripId: number) {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['bus', 'bus.seatMap', 'bus.seatMap.seats'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    const seats = trip.bus?.seatMap?.seats ?? [];
    const bookings = await this.bookingRepo.find({
      where: { trip: { id: tripId }, status: Not('CANCELLED') },
    });
    const statuses = seats.map((seat) => {
      const booking = bookings.find((b) => b.passengers.some((p) => p.seatCode === seat.code));
      const passenger = booking?.passengers.find((p) => p.seatCode === seat.code);
      const status: SeatStatus = booking ? (booking.status === 'CONFIRMED' ? 'booked' : 'reserved') : 'available';
      return {
        code: seat.code,
        row: seat.row,
        col: seat.col,
        price: seat.price ?? trip.basePrice,
        isActive: seat.isActive,
        status,
        bookedBy: passenger?.name,
        bookingId: booking?.id,
      };
    });

    return {
      seatMap: trip.bus?.seatMap
        ? {
            id: trip.bus.seatMap.id,
            name: trip.bus.seatMap.name,
            rows: trip.bus.seatMap.rows,
            cols: trip.bus.seatMap.cols,
          }
        : null,
      seats: statuses,
      basePrice: trip.basePrice,
    };
  }
}
