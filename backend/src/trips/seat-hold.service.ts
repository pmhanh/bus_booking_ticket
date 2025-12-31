import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SeatLockService } from '../redis/seat-lock.service';
import { SeatGateway } from '../realtime/seat.gateway';

@Injectable()
export class SeatHoldService {
  constructor(
    private readonly seatLockService: SeatLockService,
    private readonly seatGateway: SeatGateway,
  ) {}

  async holdSeats(tripId: number, seatCodes: string[], ttlSeconds = 120) {
    if (!seatCodes?.length) throw new BadRequestException('seatCodes is required');

    // chống duplicate seatCode
    const uniq = Array.from(new Set(seatCodes));

    const lockToken = randomUUID();
    const lockResult = await this.seatLockService.lockSeats(
      tripId,
      uniq,
      lockToken,
      ttlSeconds,
    );
    if (!lockResult.ok) {
      throw new BadRequestException(
        `Seats already held: ${(lockResult.failed ?? []).join(', ')}`,
      );
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    // 🔔 broadcast held
    this.seatGateway.emitSeatsChanged(
      tripId,
      uniq.map((seatCode) => ({ seatCode, status: 'held', expiresAt })),
    );

    return { ok: true, tripId, seatCodes: uniq, lockToken, expiresAt };
  }

  async releaseSeats(tripId: number, seatCodes: string[], lockToken: string) {
    if (!seatCodes?.length) throw new BadRequestException('seatCodes is required');
    if (!lockToken) throw new BadRequestException('lockToken is required');

    const uniq = Array.from(new Set(seatCodes));

    await this.seatLockService.assertOwnedLocks(tripId, uniq, lockToken);
    await this.seatLockService.unlockSeats(tripId, uniq, lockToken);

    // 🔔 broadcast released
    this.seatGateway.emitSeatsChanged(
      tripId,
      uniq.map((seatCode) => ({ seatCode, status: 'released' })),
    );

    return { ok: true };
  }
}
