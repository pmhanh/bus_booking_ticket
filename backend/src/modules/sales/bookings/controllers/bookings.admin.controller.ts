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
import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../core/guards/roles.guard';
import { Roles } from '../../../../core/decorators/roles.decorator';
import { BookingsService } from '../bookings.service';
import {
  ProcessRefundDto,
  UpdateBookingStatusDto,
  ListBookingsDto,
} from '../dto/booking.dto';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bookings')
export class BookingsAdminController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(@Query() query: ListBookingsDto) {
    return this.bookingsService.listForAdmin(query);
  }

  @Get(':reference')
  findByReference(@Param('reference') reference: string) {
    return this.bookingsService.getAdminBooking(reference);
  }

  @Patch(':reference/status')
  updateStatus(
    @Param('reference') reference: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateAdminStatus(reference, dto);
  }

  @Post(':reference/refund')
  processRefund(
    @Param('reference') reference: string,
    @Body() dto: ProcessRefundDto,
  ) {
    return this.bookingsService.processRefund(reference, dto);
  }
}
