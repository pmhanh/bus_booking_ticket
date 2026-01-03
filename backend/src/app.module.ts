import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { User } from './users/user.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { City } from './cities/city.entity';
import { Route } from './routes/route.entity';
import { RouteStop } from './routes/route-stop.entity';
import { SeatMap } from './seat-maps/seat-map.entity';
import { SeatDefinition } from './seat-maps/seat-definition.entity';
import { Bus } from './buses/bus.entity';
import { Trip } from './trips/trip.entity';
import { Booking } from './bookings/booking.entity';
import { BookingDetail } from './bookings/booking-detail.entity';
import { Payment } from './payments/entities/payment.entity';
import { CitiesModule } from './cities/cities.module';
import { RoutesModule } from './routes/routes.module';
import { SeatMapsModule } from './seat-maps/seat-maps.module';
import { BusesModule } from './buses/buses.module';
import { TripsModule } from './trips/trips.module';
import { BookingsModule } from './bookings/bookings.module';
import { TripSeat } from './trips/trip-seat.entity';
import { RealtimeModule } from './realtime/realtime.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { AdminBookingsModule } from './admin-bookings/admin-bookings.module';

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
          ],
          synchronize: true,
        };
      },
    }),
    UsersModule,
    AuthModule,
    DashboardModule,
    CitiesModule,
    RoutesModule,
    SeatMapsModule,
    BusesModule,
    TripsModule,
    BookingsModule,
    RealtimeModule,
    PaymentsModule,
    ReportsModule,
    AdminBookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
