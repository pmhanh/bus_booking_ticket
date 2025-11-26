import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({
  origin: ['https://bus-booking-ticket-1.onrender.com', 'http://localhost:5173'],
  credentials: true,
});
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
