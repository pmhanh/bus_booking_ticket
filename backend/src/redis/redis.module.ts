import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';
import { SeatLockService } from './seat-lock.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const tlsEnabled = (config.get<string>('REDIS_TLS') ?? 'false') === 'true';

        const commonOptions: RedisOptions = {
          maxRetriesPerRequest: 2,
          ...(tlsEnabled ? { tls: {} } : {}),
        };

        const client = redisUrl
          ? new Redis(redisUrl, {
              ...commonOptions,
              ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
            })
          : new Redis({
              host: config.get<string>('REDIS_HOST') ?? '127.0.0.1',
              port: Number(config.get<string>('REDIS_PORT') ?? 6379),
              password: config.get<string>('REDIS_PASSWORD') || undefined,
              ...commonOptions,
            });

        // Prevent Node from crashing with "Unhandled error event" when Redis is down.
        client.on('error', (err) => {
          console.error('[redis] error:', err?.message || err);
        });

        return client;
      },
    },
    SeatLockService,
  ],
  exports: ['REDIS', SeatLockService],
})
export class RedisModule {}
