import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { SeatLock } from './seat-lock.entity';

@Injectable()
export class SeatLockScheduler {
  private readonly logger = new Logger(SeatLockScheduler.name);

  constructor(
    @InjectRepository(SeatLock)
    private readonly seatLockRepo: Repository<SeatLock>,
  ) {}

  @Cron('*/30 * * * * *')
  async expireLocks() {
    const now = new Date();
    const expired = await this.seatLockRepo.find({
      where: { status: 'ACTIVE', expiresAt: LessThan(now) },
      relations: ['trip'],
    });
    if (!expired.length) return;

    await this.seatLockRepo.update(
      { id: In(expired.map((l) => l.id)) },
      { status: 'EXPIRED' },
    );

    const tripIds = Array.from(new Set(expired.map((l) => l.trip.id)));
    this.logger.debug(
      `Expired ${expired.length} seat locks across trips: ${tripIds.join(', ')}`,
    );
  }
}
