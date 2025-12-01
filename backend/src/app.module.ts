import { Module } from '@nestjs/common';
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
import { CitiesModule } from './cities/cities.module';
import { RoutesModule } from './routes/routes.module';
import { SeatMapsModule } from './seat-maps/seat-maps.module';
import { BusesModule } from './buses/buses.module';
import { TripsModule } from './trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url =
          config.get<string>('DATABASE_URL') ||
          'postgres://postgres:postgres@localhost:5432/bus_ticket_booking';
        return {
          type: 'postgres',
          url,
          entities: [User, City, Route, RouteStop, SeatMap, SeatDefinition, Bus, Trip],
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
