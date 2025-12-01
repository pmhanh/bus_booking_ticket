import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusesService } from './buses.service';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { UpdateBusSeatMapDto } from './dto/update-bus-seat-map.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/buses')
export class BusesController {
  constructor(private readonly busesService: BusesService) {}

  @Get()
  list() {
    return this.busesService.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateBusDto) {
    return this.busesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBusDto) {
    return this.busesService.update(id, dto);
  }

  @Patch(':id/seat-map')
  updateSeatMap(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBusSeatMapDto) {
    return this.busesService.updateSeatMap(id, dto);
  }
}
