import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from './route.entity';
import { RouteStop } from './route-stop.entity';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { City } from '../cities/city.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Route, RouteStop, City])],
  providers: [RoutesService],
  controllers: [RoutesController],
  exports: [RoutesService],
})
export class RoutesModule {}
