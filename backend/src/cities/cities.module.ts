import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { City } from './city.entity';
import { CitiesService } from './cities.service';
import { CitiesController } from './cities.controller';
import { CitiesPublicController } from './cities-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([City]), HttpModule],
  providers: [CitiesService],
  controllers: [CitiesController, CitiesPublicController],
  exports: [CitiesService],
})
export class CitiesModule {}
