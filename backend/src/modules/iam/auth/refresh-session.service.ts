import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { AuthConfigService } from './auth-config.service';

type RefreshSession = {
  userId: string;
  sessionId: string;
};

const TOKEN_KEY_PREFIX = 'auth:refresh:token:';
const USER_KEY_PREFIX = 'auth:refresh:user:';

@Injectable()
export class RefreshSessionService {
  readonly ttlSeconds: number;

  constructor(
    @Inject('REDIS') private readonly redis: Redis,
    authConfig: AuthConfigService,
  ) {
    this.ttlSeconds = authConfig.refreshTokenTtlSeconds;
  }

  async create(userId: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = this.hash(token);
      const session: RefreshSession = { userId, sessionId: randomUUID() };

      const created = await this.redis.eval(
        `
          if redis.call('EXISTS', KEYS[1]) == 1 then
            return 0
          end
          redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
          redis.call('SADD', KEYS[2], ARGV[3])
          redis.call('EXPIRE', KEYS[2], ARGV[2])
          return 1
        `,
        2,
        this.tokenKey(tokenHash),
        this.userKey(userId),
        JSON.stringify(session),
        this.ttlSeconds,
        tokenHash,
      );

      if (Number(created) === 1) return token;
    }

    throw new Error('Unable to create refresh session');
  }

  async consume(token: string): Promise<RefreshSession | null> {
    const tokenHash = this.hash(token);
    const raw = await this.redis.eval(
      `
        local value = redis.call('GET', KEYS[1])
        if not value then
          return nil
        end
        local session = cjson.decode(value)
        redis.call('DEL', KEYS[1])
        redis.call('SREM', ARGV[1] .. session.userId, ARGV[2])
        return value
      `,
      1,
      this.tokenKey(tokenHash),
      USER_KEY_PREFIX,
      tokenHash,
    );

    return typeof raw === 'string' ? (JSON.parse(raw) as RefreshSession) : null;
  }

  async revoke(token: string): Promise<void> {
    await this.consume(token);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.redis.eval(
      `
        local hashes = redis.call('SMEMBERS', KEYS[1])
        for _, hash in ipairs(hashes) do
          redis.call('DEL', ARGV[1] .. hash)
        end
        redis.call('DEL', KEYS[1])
        return #hashes
      `,
      1,
      this.userKey(userId),
      TOKEN_KEY_PREFIX,
    );
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokenKey(tokenHash: string): string {
    return `${TOKEN_KEY_PREFIX}${tokenHash}`;
  }

  private userKey(userId: string): string {
    return `${USER_KEY_PREFIX}${userId}`;
  }
}
