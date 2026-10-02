import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class SeatLockService {
  // key: seatlock:trip:{tripId}:seat:{seatCode} -> token
  private key(tripId: number, seatCode: string) {
    return `seatlock:trip:${tripId}:seat:${seatCode}`;
  }

  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async extendOwnedLocks(
    tripId: number,
    seatCodes: string[],
    token: string,
    expiresAt: Date,
  ) {
    const codes = [...new Set(seatCodes)];
    if (!codes.length || !token || expiresAt.getTime() <= Date.now())
      throw new BadRequestException('Invalid payment hold');
    const updated = await this.redis.eval(
      `
      for _, key in ipairs(KEYS) do
        if redis.call('GET', key) ~= ARGV[1] then return 0 end
      end
      for _, key in ipairs(KEYS) do redis.call('PEXPIREAT', key, ARGV[2]) end
      return 1
    `,
      codes.length,
      ...codes.map((code) => this.key(tripId, code)),
      token,
      expiresAt.getTime(),
    );
    if (Number(updated) !== 1)
      throw new BadRequestException('Seat holds missing or expired');
  }

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
    if (!uniq.length) return new Map<string, string | null>();
    const pipe = this.redis.pipeline();
    uniq.forEach((code) => pipe.get(this.key(tripId, code)));
    const res = await pipe.exec(); // [ [err, value], ... ]
    if (!res || res.length !== uniq.length)
      throw new Error('Cannot read seat holds');
    for (const [error] of res) {
      if (error) throw error;
    }
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
  ): Promise<Date> {
    const codes = [
      ...new Set(seatCodes.map((code) => code.trim()).filter(Boolean)),
    ];
    if (!codes.length || !token)
      throw new BadRequestException('Seat codes and lock token are required');
    // Read ownership and TTL atomically so a replacement lock cannot extend an old booking.
    const startedAt = Date.now();
    const ttl = Number(
      await this.redis.eval(
        `
      local minimum = nil
      for _, key in ipairs(KEYS) do
        if redis.call('GET', key) ~= ARGV[1] then return -1 end
        local ttl = redis.call('PTTL', key)
        if ttl <= 0 then return -1 end
        if minimum == nil or ttl < minimum then minimum = ttl end
      end
      return minimum or -1
    `,
        codes.length,
        ...codes.map((code) => this.key(tripId, code)),
        token,
      ),
    );
    const expiresAt = new Date(startedAt + ttl);
    if (
      !Number.isFinite(ttl) ||
      ttl <= 0 ||
      expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Seat holds missing or expired');
    }
    return expiresAt;
  }
}
