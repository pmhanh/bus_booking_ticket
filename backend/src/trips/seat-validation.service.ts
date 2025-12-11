import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  In,
  MoreThan,
} from 'typeorm';
import { Trip } from './trip.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { SeatLock } from './seat-lock.entity';
import { Booking } from '../bookings/booking.entity';

@Injectable()
export class SeatValidationService {
  private readonly maxSeatsPerBooking: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.maxSeatsPerBooking = Number(
      this.configService.get('MAX_SEATS_PER_BOOKING') ?? 6,
    );
  }

  private sameOwner(
    lock: SeatLock,
    userId?: string,
    guestSessionId?: string,
  ) {
    if (lock.userId && userId) return lock.userId === userId;
    if (lock.guestSessionId && guestSessionId)
      return lock.guestSessionId === guestSessionId;
    if (!lock.userId && !lock.guestSessionId)
      return !userId && !guestSessionId;
    return false;
  }

  private ensureSeatsExist(seatMap: SeatMap, seatCodes: string[]) {
    const lookup = new Map(seatMap.seats.map((s) => [s.code, s]));
    const missing = seatCodes.filter((code) => !lookup.has(code));
    if (missing.length)
      throw new BadRequestException(
        `Seats not found: ${missing.join(', ')}`,
      );
    const inactive = seatCodes.filter(
      (code) => lookup.get(code)?.isActive === false,
    );
    if (inactive.length)
      throw new BadRequestException(
        `Inactive seats cannot be booked: ${inactive.join(', ')}`,
      );
    return seatCodes.map((code) => lookup.get(code)!);
  }

  private async validateWithManager(
    manager: EntityManager,
    tripId: number,
    seatCodes: string[],
    lockToken?: string,
    userId?: string,
    guestSessionId?: string,
  ) {
    if (!seatCodes.length)
      throw new BadRequestException('At least one seat is required');
    if (seatCodes.length > this.maxSeatsPerBooking) {
      throw new BadRequestException(
        `Seat limit exceeded (max ${this.maxSeatsPerBooking})`,
      );
    }

    const trip = await manager.findOne(Trip, {
      where: { id: tripId },
      relations: ['bus', 'bus.seatMap', 'route'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.bus?.seatMap?.id)
      throw new BadRequestException('Trip has no seat map assigned');
    const seatMap = await manager.findOne(SeatMap, {
      where: { id: trip.bus.seatMap.id },
      relations: ['seats'],
    });
    if (!seatMap) throw new NotFoundException('Seat map not found for bus');

    const seats = this.ensureSeatsExist(seatMap, seatCodes);
    const now = new Date();

    const activeBookings = await manager.find(Booking, {
      where: [
        { trip: { id: tripId }, status: 'CONFIRMED' },
        {
          trip: { id: tripId },
          status: 'PENDING',
          expiresAt: MoreThan(now),
        },
      ],
    });
    const booked = new Set(
      activeBookings.flatMap((b) => b.seats.map((s) => s.trim())),
    );
    const bookedConflicts = seatCodes.filter((code) => booked.has(code));
    if (bookedConflicts.length) {
      throw new BadRequestException(
        `Seat ${bookedConflicts[0]} already booked`,
      );
    }

    const activeLocks = await manager.find(SeatLock, {
      where: {
        trip: { id: tripId },
        seatCode: In(seatCodes),
        status: 'ACTIVE',
        expiresAt: MoreThan(now),
      },
    });
    const conflictingLock = activeLocks.find(
      (lock) =>
        lock.lockToken !== lockToken && !this.sameOwner(lock, userId, guestSessionId),
    );
    if (conflictingLock) {
      throw new BadRequestException(
        `Seat ${conflictingLock.seatCode} locked by another user`,
      );
    }

    return { trip, seatMap, seats };
  }

  async validateSeatsForBooking(
    tripId: number,
    seatCodes: string[],
    lockToken?: string,
    userId?: string,
    guestSessionId?: string,
    manager?: EntityManager,
  ) {
    if (manager) {
      return this.validateWithManager(
        manager,
        tripId,
        seatCodes,
        lockToken,
        userId,
        guestSessionId,
      );
    }

    return this.dataSource.transaction((trx) =>
      this.validateWithManager(
        trx,
        tripId,
        seatCodes,
        lockToken,
        userId,
        guestSessionId,
      ),
    );
  }
}
