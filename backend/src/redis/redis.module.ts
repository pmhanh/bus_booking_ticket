import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { SeatLockService } from './seat-lock.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST') ?? '127.0.0.1';
        const port = Number(config.get<string>('REDIS_PORT') ?? 6379);
        const password = config.get<string>('REDIS_PASSWORD') || undefined;

        return new Redis({
          host,
          port,
          password,
          maxRetriesPerRequest: 2,
        });
      },
    },
    SeatLockService,
  ],
  exports: ['REDIS', SeatLockService],
})
export class RedisModule {}