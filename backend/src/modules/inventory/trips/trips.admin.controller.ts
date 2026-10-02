import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { Roles } from '../../../core/decorators/roles.decorator';
import { ListTripsDto } from './dto/list-trips.dto';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(@Body() dto: CreateTripDto) {
    return this.tripsService.create(dto);
  }

  @Get()
  list(@Query() query: ListTripsDto) {
    return this.tripsService.list(query);
  }

  @Get(':id')
  get(@Param('id') id: number) {
    return this.tripsService.findPublicById(id);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: number) {
    return this.tripsService.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.tripsService.delete(id);
  }

  @Get(':id/passengers')
  getPassengers(@Param('id') id: number) {
    return this.tripsService.getPassengers(id);
  }

  @Patch(':id/passengers/:bookingDetailId/check-in')
  checkInPassenger(
    @Param('id') id: number,
    @Param('bookingDetailId') bookingDetailId: number,
  ) {
    return this.tripsService.checkInPassenger(id, bookingDetailId);
  }

  @Patch(':id/passengers/:bookingDetailId/undo-check-in')
  undoCheckInPassenger(
    @Param('id') id: number,
    @Param('bookingDetailId') bookingDetailId: number,
  ) {
    return this.tripsService.checkInPassenger(id, bookingDetailId, true);
  }

  @Patch(':id/operational-status')
  updateOperationalStatus(
    @Param('id') id: number,
    @Body() body: { status: 'DEPARTED' | 'ARRIVED' },
  ) {
    return this.tripsService.updateOperationalStatus(id, body.status);
  }
}
