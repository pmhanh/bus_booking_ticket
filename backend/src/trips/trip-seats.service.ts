import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, LessThan, MoreThan, Repository } from 'typeorm';
import { Trip } from './trip.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { SeatLock } from './seat-lock.entity';
import { LockSeatsDto } from './dto/lock-seats.dto';
import { RefreshLockDto } from './dto/refresh-lock.dto';
import { Booking } from '../bookings/booking.entity';

type SeatStatus = 'available' | 'locked' | 'held' | 'inactive';

@Injectable()
export class TripSeatsService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    @InjectRepository(SeatLock)
    private readonly seatLockRepo: Repository<SeatLock>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

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
      order: { seats: { row: 'ASC', col: 'ASC' } },
    });
    if (!seatMap) throw new NotFoundException('Seat map not found for bus');
    return { trip, seatMap };
  }

  private async pruneExpiredLocks(tripId: number) {
    await this.seatLockRepo.delete({
      trip: { id: tripId },
      expiresAt: LessThan(new Date()),
    });
  }

  private async expireOldBookings(tripId: number) {
    const expired = await this.bookingRepo.find({
      where: { trip: { id: tripId }, status: 'PENDING', expiresAt: LessThan(new Date()) },
    });
    if (expired.length) {
      await this.bookingRepo.update(
        { id: In(expired.map((b) => b.id)) },
        { status: 'EXPIRED' },
      );
    }
  }

  private mapSeats(
    seatMap: SeatMap,
    locks: SeatLock[],
    activeBookings: Booking[],
    lockToken?: string,
  ) {
    const lockBySeat = new Map<string, SeatLock>();
    locks.forEach((lock) => lockBySeat.set(lock.seatCode, lock));
    const bookedSeats = new Set<string>();
    activeBookings.forEach((b) => b.seats.forEach((s) => bookedSeats.add(s)));
    return seatMap.seats.map((seat) => {
      const lock = lockBySeat.get(seat.code);
      let status: SeatStatus = 'available';
      if (!seat.isActive) {
        status = 'inactive';
      } else if (bookedSeats.has(seat.code)) {
        status = 'locked';
      } else if (lock) {
        status = lock.lockToken === lockToken ? 'held' : 'locked';
      }
      return {
        ...seat,
        status,
        lockedUntil: lock?.expiresAt,
        lockToken: lock?.lockToken,
      };
    });
  }

  async getSeatMap(tripId: number, lockToken?: string) {
    const { trip, seatMap } = await this.getTripContext(tripId);
    await this.pruneExpiredLocks(tripId);
    await this.expireOldBookings(tripId);
    const locks = await this.seatLockRepo.find({
      where: { trip: { id: tripId }, expiresAt: MoreThan(new Date()) },
    });
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

    return {
      trip: {
        id: trip.id,
        basePrice: trip.basePrice,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        status: trip.status,
        route: trip.route,
        bus: trip.bus,
      },
      seatMap: {
        id: seatMap.id,
        name: seatMap.name,
        rows: seatMap.rows,
        cols: seatMap.cols,
      },
      seats: this.mapSeats(seatMap, locks, activeBookings, lockToken),
    };
  }

  private resolveExpiry(holdMinutes?: number) {
    const minutes = Math.min(Math.max(holdMinutes ?? 5, 1), 30);
    return new Date(Date.now() + minutes * 60000);
  }

  async lockSeats(tripId: number, dto: LockSeatsDto, userId: string) {
    const { trip, seatMap } = await this.getTripContext(tripId);
    await this.pruneExpiredLocks(tripId);
    await this.expireOldBookings(tripId);
    const expiresAt = this.resolveExpiry(dto.holdMinutes);
    const requested = Array.from(new Set(dto.seats.map((s) => s.trim())));
    if (!requested.length)
      throw new BadRequestException('At least one seat is required');
    const seatLookup = new Map(seatMap.seats.map((s) => [s.code, s]));
    const invalid = requested.filter((code) => {
      const seat = seatLookup.get(code);
      return !seat || !seat.isActive;
    });
    if (invalid.length)
      throw new BadRequestException(
        `Invalid or inactive seats: ${invalid.join(', ')}`,
      );

    let lockToken = dto.lockToken ?? randomUUID();
    if (dto.lockToken) {
      const existing = await this.seatLockRepo.find({
        where: { trip: { id: tripId }, lockToken: dto.lockToken },
      });
      if (!existing.length)
        throw new NotFoundException('Lock token not found or expired');
      if (existing[0].userId && existing[0].userId !== userId)
        throw new ForbiddenException('Lock token belongs to another user');
      await this.seatLockRepo.delete({
        trip: { id: tripId },
        lockToken: dto.lockToken,
      });
      lockToken = dto.lockToken;
    }

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
    const bookedSeats = new Set(
      activeBookings.flatMap((b) => b.seats.map((s) => s.trim())),
    );
    const bookedConflicts = requested.filter((s) => bookedSeats.has(s));
    if (bookedConflicts.length)
      throw new BadRequestException(
        `Seats already booked: ${bookedConflicts.join(', ')}`,
      );

    const activeConflicts = await this.seatLockRepo.find({
      where: {
        trip: { id: tripId },
        seatCode: In(requested),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (activeConflicts.length)
      throw new BadRequestException('Some seats are already locked');

    const locks = requested.map((code) =>
      this.seatLockRepo.create({
        trip,
        seatCode: code,
        userId,
        lockToken,
        expiresAt,
      }),
    );
    await this.seatLockRepo.save(locks);

    const availability = await this.getSeatMap(tripId, lockToken);
    return {
      lockToken,
      expiresAt,
      seats: requested,
      availability,
    };
  }

  async refreshLock(
    tripId: number,
    token: string,
    dto: RefreshLockDto,
    userId: string,
  ) {
    await this.pruneExpiredLocks(tripId);
    const locks = await this.seatLockRepo.find({
      where: { trip: { id: tripId }, lockToken: token },
    });
    if (!locks.length)
      throw new NotFoundException('Lock not found or already expired');
    if (locks[0].userId && locks[0].userId !== userId)
      throw new ForbiddenException('Lock token belongs to another user');
    const expiresAt = this.resolveExpiry(dto.holdMinutes);
    locks.forEach((l) => (l.expiresAt = expiresAt));
    await this.seatLockRepo.save(locks);
    const availability = await this.getSeatMap(tripId, token);
    return {
      lockToken: token,
      expiresAt,
      seats: locks.map((l) => l.seatCode),
      availability,
    };
  }

  async releaseLock(tripId: number, token: string, userId: string) {
    const locks = await this.seatLockRepo.find({
      where: { trip: { id: tripId }, lockToken: token },
    });
    if (!locks.length) return { released: false };
    if (locks[0].userId && locks[0].userId !== userId)
      throw new ForbiddenException('Lock token belongs to another user');
    await this.seatLockRepo.delete({ trip: { id: tripId }, lockToken: token });
    const availability = await this.getSeatMap(tripId);
    return { released: true, availability };
  }
}
