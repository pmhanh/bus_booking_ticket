import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatMap } from './seat-map.entity';
import { SeatDefinition } from './seat-definition.entity';
import { SeatMapsService } from './seat-maps.service';
import { SeatMapsController } from './seat-maps.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SeatMap, SeatDefinition])],
  providers: [SeatMapsService],
  controllers: [SeatMapsController],
  exports: [SeatMapsService],
})
export class SeatMapsModule {}
