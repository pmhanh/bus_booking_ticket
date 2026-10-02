import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/iam/auth/auth.module';
import { UsersModule } from './modules/iam/users/users.module';
import { User } from './modules/iam/users/user.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { City } from './modules/fleet/cities/city.entity';
import { Route } from './modules/fleet/routes/route.entity';
import { RouteStop } from './modules/fleet/routes/route-stop.entity';
import { SeatMap } from './modules/fleet/seat-maps/seat-map.entity';
import { SeatDefinition } from './modules/fleet/seat-maps/seat-definition.entity';
import { Bus } from './modules/fleet/buses/bus.entity';
import { Trip } from './modules/inventory/trips/trip.entity';
import { Booking } from './modules/sales/bookings/entities/booking.entity';
import { BookingDetail } from './modules/sales/bookings/entities/booking-detail.entity';
import { Payment } from './modules/sales/payments/entities/payment.entity';
import { CitiesModule } from './modules/fleet/cities/cities.module';
import { RoutesModule } from './modules/fleet/routes/routes.module';
import { SeatMapsModule } from './modules/fleet/seat-maps/seat-maps.module';
import { BusesModule } from './modules/fleet/buses/buses.module';
import { BookingsModule } from './modules/sales/bookings/bookings.module';
import { TripSeat } from './modules/inventory/trip-seats/trip-seat.entity';
import { RealtimeModule } from './infrastructure/realtime/realtime.module';
import { PaymentsModule } from './modules/sales/payments/payments.module';
import { ReviewsModule } from './modules/sales/reviews/reviews.module';
import { Review } from './modules/sales/reviews/review.entity';
import { TripInventoryModule } from './modules/inventory/trip-seats/trip-seats.module';
import { TripsCatalogModule } from './modules/inventory/trips/trips.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url =
          config.get<string>('DATABASE_URL') ||
          'postgres://postgres:postgres@localhost:5432/bus_ticket_booking';
        return {
          type: 'postgres',
          url,
          entities: [
            User,
            City,
            Route,
            RouteStop,
            SeatMap,
            SeatDefinition,
            Bus,
            Trip,
            Booking,
            BookingDetail,
            TripSeat,
            Payment,
            Review,
          ],
          synchronize: true,
        };
      },
    }),
    UsersModule,
    AuthModule,
    AnalyticsModule,
    CitiesModule,
    RoutesModule,
    SeatMapsModule,
    BusesModule,
    TripsCatalogModule,
    TripInventoryModule,
    BookingsModule,
    RealtimeModule,
    PaymentsModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
