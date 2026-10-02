import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import Redis from 'ioredis';

const STATE_KEY_PREFIX = 'auth:oauth:state:';
const STATE_TTL_SECONDS = 5 * 60;

@Injectable()
export class OAuthStateService {
  readonly ttlMilliseconds = STATE_TTL_SECONDS * 1000;

  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async create(returnTo?: string): Promise<string> {
    const state = randomBytes(32).toString('base64url');
    await this.redis.set(
      this.key(state),
      JSON.stringify({ returnTo: this.normalizeReturnTo(returnTo) }),
      'EX',
      STATE_TTL_SECONDS,
      'NX',
    );
    return state;
  }

  async consume(state?: string, cookieState?: string): Promise<string> {
    if (!state || !cookieState || !this.matches(state, cookieState)) {
      throw new UnauthorizedException('OAuth state không hợp lệ');
    }

    const raw = await this.redis.eval(
      `
        local value = redis.call('GET', KEYS[1])
        if value then
          redis.call('DEL', KEYS[1])
        end
        return value
      `,
      1,
      this.key(state),
    );

    if (typeof raw !== 'string') {
      throw new UnauthorizedException(
        'OAuth state đã hết hạn hoặc đã được sử dụng',
      );
    }

    const parsed = JSON.parse(raw) as { returnTo?: string };
    return this.normalizeReturnTo(parsed.returnTo);
  }

  private normalizeReturnTo(returnTo?: string): string {
    if (
      !returnTo ||
      returnTo.length > 2048 ||
      !returnTo.startsWith('/') ||
      returnTo.startsWith('//') ||
      returnTo.includes('\\')
    ) {
      return '/';
    }
    return returnTo;
  }

  private matches(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private key(state: string): string {
    const hash = createHash('sha256').update(state).digest('hex');
    return `${STATE_KEY_PREFIX}${hash}`;
  }
}
