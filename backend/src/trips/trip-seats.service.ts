import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';
import { Trip } from './trip.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { SeatLock } from './seat-lock.entity';
import { LockSeatsDto } from './dto/lock-seats.dto';
import { RefreshLockDto } from './dto/refresh-lock.dto';
import { Booking } from '../bookings/booking.entity';

type SeatStatus = 'available' | 'locked' | 'held' | 'inactive' | 'booked';

@Injectable()
export class TripSeatsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    @InjectRepository(SeatLock)
    private readonly seatLockRepo: Repository<SeatLock>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  private ownsLock(lock: SeatLock, userId?: string, guestSessionId?: string) {
    if (lock.userId && userId) return lock.userId === userId;
    if (lock.guestSessionId && guestSessionId)
      return lock.guestSessionId === guestSessionId;
    if (!lock.userId && !lock.guestSessionId) return !userId && !guestSessionId;
    return false;
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
      order: { seats: { row: 'ASC', col: 'ASC' } },
    });
    if (!seatMap) throw new NotFoundException('Seat map not found for bus');
    return { trip, seatMap };
  }

  private async expireOldLocks(tripId: number) {
    const now = new Date();
    const expired = await this.seatLockRepo.find({
      where: { trip: { id: tripId }, status: 'ACTIVE', expiresAt: LessThan(now) },
    });
    if (!expired.length) return;
    await this.seatLockRepo.update(
      { id: In(expired.map((l) => l.id)) },
      { status: 'EXPIRED' },
    );
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
        status = 'booked';
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
    await this.expireOldLocks(tripId);
    await this.expireOldBookings(tripId);
    const locks = await this.seatLockRepo.find({
      where: {
        trip: { id: tripId },
        status: 'ACTIVE',
        expiresAt: MoreThan(new Date()),
      },
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

  async lockSeats(tripId: number, dto: LockSeatsDto, userId?: string) {
    const { trip, seatMap } = await this.getTripContext(tripId);
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

    const guestSessionId = dto.guestSessionId;
    const expiresAt = this.resolveExpiry(dto.holdMinutes);

    const result = await this.dataSource.transaction(async (manager) => {
      const lockRepo = manager.getRepository(SeatLock);
      const bookingRepo = manager.getRepository(Booking);
      await lockRepo.update(
        {
          trip: { id: tripId },
          status: 'ACTIVE',
          expiresAt: LessThan(new Date()),
        },
        { status: 'EXPIRED' },
      );
      await bookingRepo.update(
        {
          trip: { id: tripId },
          status: 'PENDING',
          expiresAt: LessThan(new Date()),
        },
        { status: 'EXPIRED' },
      );

      let lockToken = dto.lockToken ?? randomUUID();
      if (dto.lockToken) {
        const existing = await lockRepo.find({
          where: {
            trip: { id: tripId },
            lockToken: dto.lockToken,
            status: 'ACTIVE',
            expiresAt: MoreThan(new Date()),
          },
        });
        if (!existing.length)
          throw new NotFoundException('Lock token not found or expired');
        const owner = existing[0];
        if (
          (owner.userId && userId && owner.userId !== userId) ||
          (owner.guestSessionId &&
            guestSessionId &&
            owner.guestSessionId !== guestSessionId)
        ) {
          throw new ForbiddenException('Lock token belongs to another user');
        }
        await lockRepo.update(
          { trip: { id: tripId }, lockToken: dto.lockToken },
          { status: 'RELEASED' },
        );
        lockToken = dto.lockToken;
      }

      const activeBookings = await bookingRepo.find({
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

      const activeConflicts = await lockRepo.find({
        where: {
          trip: { id: tripId },
          seatCode: In(requested),
          status: 'ACTIVE',
          expiresAt: MoreThan(new Date()),
        },
      });
      const blockingLocks = activeConflicts.filter(
        (lock) => !this.ownsLock(lock, userId, guestSessionId),
      );
      if (blockingLocks.length)
        throw new BadRequestException('Some seats are already locked');

      const locks = requested.map((code) =>
        lockRepo.create({
          trip,
          seatCode: code,
          userId,
          guestSessionId,
          lockToken,
          expiresAt,
          status: 'ACTIVE',
        }),
      );
      await lockRepo.save(locks);
      return { lockToken, expiresAt, seats: requested };
    });

    const availability = await this.getSeatMap(tripId, result.lockToken);
    const response = { ...result, availability };
    return response;
  }

  async refreshLock(
    tripId: number,
    token: string,
    dto: RefreshLockDto,
    userId?: string,
    guestSessionId?: string,
  ) {
    await this.expireOldLocks(tripId);
    const locks = await this.seatLockRepo.find({
      where: {
        trip: { id: tripId },
        lockToken: token,
        status: 'ACTIVE',
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!locks.length)
      throw new NotFoundException('Lock not found or already expired');
    if (!this.ownsLock(locks[0], userId, guestSessionId))
      throw new ForbiddenException('Lock token belongs to another user');
    const expiresAt = this.resolveExpiry(dto.holdMinutes);
    locks.forEach((l) => (l.expiresAt = expiresAt));
    await this.seatLockRepo.save(locks);
    const availability = await this.getSeatMap(tripId, token);
    const response = {
      lockToken: token,
      expiresAt,
      seats: locks.map((l) => l.seatCode),
      availability,
    };
    return response;
  }

  async releaseLock(
    tripId: number,
    token: string,
    userId?: string,
    guestSessionId?: string,
  ) {
    const locks = await this.seatLockRepo.find({
      where: {
        trip: { id: tripId },
        lockToken: token,
        status: 'ACTIVE',
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!locks.length) return { released: false };
    if (!this.ownsLock(locks[0], userId, guestSessionId))
      throw new ForbiddenException('Lock token belongs to another user');
    await this.seatLockRepo.update(
      { trip: { id: tripId }, lockToken: token },
      { status: 'RELEASED' },
    );
    const availability = await this.getSeatMap(tripId);
    return { released: true, availability };
  }
}
