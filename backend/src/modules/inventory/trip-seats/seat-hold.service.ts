import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { SeatLockService } from '../../../infrastructure/redis/seat-lock.service';
import { SeatGateway } from '../../../infrastructure/realtime/seat.gateway';
import { SeatValidationService } from './seat-validation.service';
import { Trip } from '../trips/trip.entity';

const DEFAULT_HOLD_TTL_SECONDS = 300;

@Injectable()
export class SeatHoldService {
  constructor(
    private readonly seatLockService: SeatLockService,
    private readonly seatGateway: SeatGateway,
    private readonly seatValidationService: SeatValidationService,
    private readonly dataSource: DataSource,
  ) {}

  private withTripLock<T>(
    tripId: number,
    action: (manager: EntityManager) => Promise<T>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const trip = await manager.findOne(Trip, {
        where: { id: tripId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!trip) throw new NotFoundException('Trip not found');
      return action(manager);
    });
  }

  async holdSeats(
    tripId: number,
    seatCodes: string[],
    ttlSeconds = DEFAULT_HOLD_TTL_SECONDS,
  ) {
    return this.withTripLock(tripId, async (manager) => {
      const { tripSeats } =
        await this.seatValidationService.validateSeatsForBooking(
          tripId,
          seatCodes,
          manager,
        );
      const validSeatCodes = tripSeats.map((seat) => seat.seatCodeSnapshot);

      const lockToken = randomUUID();
      const lockResult = await this.seatLockService.lockSeats(
        tripId,
        validSeatCodes,
        lockToken,
        ttlSeconds,
      );
      if (!lockResult.ok) {
        throw new BadRequestException(
          `Seats already held: ${(lockResult.failed ?? []).join(', ')}`,
        );
      }

      const expiresAt = (
        await this.seatLockService.assertOwnedLocks(
          tripId,
          validSeatCodes,
          lockToken,
        )
      ).toISOString();

      this.seatGateway.emitSeatHeld(tripId, validSeatCodes, expiresAt);

      return {
        ok: true,
        tripId,
        seatCodes: validSeatCodes,
        lockToken,
        expiresAt,
      };
    });
  }

  async releaseSeats(tripId: number, seatCodes: string[], lockToken: string) {
    if (!seatCodes?.length)
      throw new BadRequestException('seatCodes is required');
    if (!lockToken) throw new BadRequestException('lockToken is required');

    const uniqueSeatCodes = [
      ...new Set(seatCodes.map((code) => code.trim()).filter(Boolean)),
    ];

    return this.withTripLock(tripId, async () => {
      await this.seatLockService.assertOwnedLocks(
        tripId,
        uniqueSeatCodes,
        lockToken,
      );
      await this.seatLockService.unlockSeats(
        tripId,
        uniqueSeatCodes,
        lockToken,
      );

      this.seatGateway.emitSeatReleased(tripId, uniqueSeatCodes);

      return { ok: true };
    });
  }
}
