import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { TripsPublicController } from './trips-public.controller';
import { Trip } from './trip.entity';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, Route, Bus])],
  providers: [TripsService],
  controllers: [TripsController, TripsPublicController],
})
export class TripsModule {}
