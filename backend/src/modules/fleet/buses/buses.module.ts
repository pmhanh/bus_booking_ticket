import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bus } from './bus.entity';
import { BusesService } from './buses.service';
import { BusesController } from './buses.controller';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { Trip } from '../../inventory/trips/trip.entity';
import { CloudinaryModule } from '../../../infrastructure/cloudinary/cloudinary.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bus, SeatMap, Trip]), CloudinaryModule],
  providers: [BusesService],
  controllers: [BusesController],
  exports: [BusesService],
})
export class BusesModule {}
