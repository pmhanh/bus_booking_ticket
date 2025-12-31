// src/redis/seat-lock.service.ts
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class SeatLockService {
  // key: seatlock:trip:{tripId}:seat:{seatCode} -> token
  private key(tripId: number, seatCode: string) {
    return `seatlock:trip:${tripId}:seat:${seatCode}`;
  }

  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  /**
   * Try lock 1 seat with token, NX + EX TTL
   * return true if lock acquired
   */
  async lockSeat(
    tripId: number,
    seatCode: string,
    token: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const k = this.key(tripId, seatCode);
    // ✅ ioredis typing: set(key, value, 'EX', seconds, 'NX')
    const ok = await this.redis.set(k, token, 'EX', ttlSeconds, 'NX');
    return ok === 'OK';
  }

  /**
   * Lock many seats atomically-ish: if any fails -> rollback locks acquired by this token.
   */
  async lockSeats(
    tripId: number,
    seatCodes: string[],
    token: string,
    ttlSeconds: number,
  ): Promise<{ ok: boolean; failed?: string[] }> {
    const uniq = Array.from(new Set(seatCodes.map((s) => s.trim())));
    const acquired: string[] = [];
    const failed: string[] = [];

    for (const code of uniq) {
      const ok = await this.lockSeat(tripId, code, token, ttlSeconds);
      if (!ok) failed.push(code);
      else acquired.push(code);
    }

    if (failed.length) {
      await this.unlockSeats(tripId, acquired, token); // rollback
      return { ok: false, failed };
    }
    return { ok: true };
  }

  /**
   * Unlock only if token matches (owner unlock)
   */
  async unlockSeat(tripId: number, seatCode: string, token: string) {
    const k = this.key(tripId, seatCode);
    // Lua: if value==token then del
    const lua = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(lua, 1, k, token);
  }

  async unlockSeats(tripId: number, seatCodes: string[], token: string) {
    const uniq = Array.from(new Set(seatCodes.map((s) => s.trim())));
    for (const code of uniq) {
      await this.unlockSeat(tripId, code, token);
    }
  }

  /**
   * Check locks for a set of seats (fast via pipeline)
   */
  async getLockTokens(tripId: number, seatCodes: string[]) {
    const uniq = Array.from(new Set(seatCodes.map((s) => s.trim())));
    const pipe = this.redis.pipeline();
    uniq.forEach((code) => pipe.get(this.key(tripId, code)));
    const res = await pipe.exec(); // [ [err, value], ... ]
    const out = new Map<string, string | null>();
    uniq.forEach((code, i) => out.set(code, (res?.[i]?.[1] as string) ?? null));
    return out;
  }

  /**
   * Validate that all seats are locked by this token
   */
  async assertOwnedLocks(
    tripId: number,
    seatCodes: string[],
    token: string,
  ): Promise<void> {
    const locks = await this.getLockTokens(tripId, seatCodes);
    const missing: string[] = [];
    for (const [code, t] of locks.entries()) {
      if (!t || t !== token) missing.push(code);
    }
    if (missing.length) {
      throw new BadRequestException(
        `Seat holds missing or expired: ${missing.join(', ')}`,
      );
    }
  }
}







