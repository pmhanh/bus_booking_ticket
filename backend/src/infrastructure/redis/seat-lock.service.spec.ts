import { BadRequestException } from '@nestjs/common';
import Redis from 'ioredis';
import { SeatLockService } from './seat-lock.service';

describe('SeatLockService ownership', () => {
  it.each([null, [[new Error('Redis failed'), null]]])(
    'does not treat failed hold reads as free seats: %p',
    async (result) => {
      const pipe = {
        get: jest.fn(),
        exec: jest.fn().mockResolvedValue(result),
      };
      const service = new SeatLockService({
        pipeline: () => pipe,
      } as unknown as Redis);
      await expect(service.getLockTokens(7, ['A1'])).rejects.toThrow();
    },
  );
  it('checks the complete hold in one atomic command and uses the shortest TTL', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-16T10:00:00Z'));
    try {
      const redis = { eval: jest.fn().mockResolvedValue(15000) };
      const service = new SeatLockService(redis as unknown as Redis);
      const expiresAt = await service.assertOwnedLocks(
        7,
        [' A1 ', 'A2'],
        'token',
      );
      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        'seatlock:trip:7:seat:A1',
        'seatlock:trip:7:seat:A2',
        'token',
      );
      expect(expiresAt.toISOString()).toBe('2026-09-16T10:00:15.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([-1, 0])(
    'rejects missing ownership or invalid TTL %s',
    async (ttl) => {
      const service = new SeatLockService({
        eval: jest.fn().mockResolvedValue(ttl),
      } as unknown as Redis);
      await expect(
        service.assertOwnedLocks(7, ['A1'], 'old-token'),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('extends all owned seats atomically to the checkout deadline', async () => {
    const redis = { eval: jest.fn().mockResolvedValue(1) };
    const service = new SeatLockService(redis as unknown as Redis);
    const deadline = new Date(Date.now() + 900000);
    await service.extendOwnedLocks(7, ['A1', 'A2'], 'token', deadline);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('PEXPIREAT'),
      2,
      'seatlock:trip:7:seat:A1',
      'seatlock:trip:7:seat:A2',
      'token',
      deadline.getTime(),
    );
  });
  it('refuses to extend a hold whose token has expired or changed', async () => {
    const redis = { eval: jest.fn().mockResolvedValue(0) };
    const service = new SeatLockService(redis as unknown as Redis);
    await expect(
      service.extendOwnedLocks(
        7,
        ['A1'],
        'old-token',
        new Date(Date.now() + 900000),
      ),
    ).rejects.toThrow('missing or expired');
  });
});
