import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminBookingsService } from './admin-bookings.service';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { ProcessRefundDto } from './dto/process-refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { BookingStatus } from '../bookings/booking.entity';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly service: AdminBookingsService) {}

  @Get()
  list(
    @Query('status') status?: BookingStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('tripId') tripId?: string,
    @Query('routeId') routeId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.list({
      status,
      fromDate,
      toDate,
      tripId: tripId ? Number(tripId) : undefined,
      routeId: routeId ? Number(routeId) : undefined,
      search,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':reference')
  findByReference(@Param('reference') reference: string) {
    return this.service.findByReference(reference);
  }

  @Patch(':reference/status')
  updateStatus(
    @Param('reference') reference: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.service.updateStatus(reference, dto);
  }

  @Post(':reference/refund')
  processRefund(
    @Param('reference') reference: string,
    @Body() dto: ProcessRefundDto,
  ) {
    return this.service.processRefund(reference, dto);
  }
}
