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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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
  list(
    @Query('originCityId') originCityId?: string,
    @Query('destinationCityId') destinationCityId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filter: { originCityId?: number; destinationCityId?: number } = {};
    if (originCityId) filter.originCityId = Number(originCityId);
    if (destinationCityId) filter.destinationCityId = Number(destinationCityId);
    const pagination = {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    };
    return this.routesService.findAll(filter, pagination);
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

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.deactivate(id);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.activate(id);
  }
}
