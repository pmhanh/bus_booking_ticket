import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SeatMapsService } from './seat-maps.service';
import { CreateSeatMapDto } from './dto/create-seat-map.dto';
import { UpdateSeatMapDto } from './dto/update-seat-map.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/seat-maps')
export class SeatMapsController {
  constructor(private readonly seatMapsService: SeatMapsService) {}

  @Post()
  create(@Body() dto: CreateSeatMapDto) {
    return this.seatMapsService.create(dto);
  }

  @Get()
  list() {
    return this.seatMapsService.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.seatMapsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSeatMapDto) {
    return this.seatMapsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.seatMapsService.delete(id);
  }
}
