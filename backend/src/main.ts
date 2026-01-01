import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: [
      'https://bus-booking-ticket-1.onrender.com',
      'http://localhost:5173',
    ],
    credentials: true,
  });
  app.use('/api/payments/webhook', express.raw({ type: '*/*' }));
  app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
