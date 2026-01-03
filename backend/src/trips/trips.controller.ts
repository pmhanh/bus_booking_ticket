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
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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
  list(
    @Query('routeId') routeId?: string,
    @Query('busId') busId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.tripsService.list({
      routeId: routeId ? Number(routeId) : undefined,
      busId: busId ? Number(busId) : undefined,
      fromDate,
      toDate,
      status,
      sortBy,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.findPublicById(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.delete(id);
  }

  @Get(':id/passengers')
  getPassengers(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getPassengers(id);
  }

  @Patch(':id/passengers/:bookingDetailId/check-in')
  checkInPassenger(
    @Param('id', ParseIntPipe) id: number,
    @Param('bookingDetailId', ParseIntPipe) bookingDetailId: number,
  ) {
    return this.tripsService.checkInPassenger(id, bookingDetailId);
  }

  @Patch(':id/operational-status')
  updateOperationalStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'DEPARTED' | 'ARRIVED' },
  ) {
    return this.tripsService.updateOperationalStatus(id, body.status);
  }
}
