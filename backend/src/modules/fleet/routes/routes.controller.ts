import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { UpdateStopsDto } from './dto/update-stops.dto';
import { FilterRoutesDto } from './dto/filter-routes.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { Roles } from '../../../core/decorators/roles.decorator';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }

  @Get()
  list(@Query() query: FilterRoutesDto) {
    return this.routesService.findAll(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.findById(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.delete(id);
  }

  @Post(':id/stops')
  setStops(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStopsDto) {
    return this.routesService.updateStops(id, dto);
  }

  @Get(':id/stops')
  getStops(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.getStops(id);
  }
 
}
