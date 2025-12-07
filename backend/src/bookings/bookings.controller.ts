import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser() user?: User | null) {
    return this.bookingsService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  myBookings(@CurrentUser() user: User) {
    return this.bookingsService.listForUser(user.id);
  }

  @Get('lookup')
  lookup(@Query('code') code: string, @Query('phone') phone?: string, @Query('email') email?: string) {
    return this.bookingsService.lookup(code, phone, email);
  }

  @Get('trips/:tripId/seats')
  seatStatus(@Param('tripId', ParseIntPipe) tripId: number) {
    return this.bookingsService.getSeatStatusForTrip(tripId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user?: User | null, @Query('phone') phone?: string, @Query('email') email?: string) {
    return this.bookingsService.getOne(id, user, phone, email);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto, @CurrentUser() user?: User | null) {
    return this.bookingsService.update(id, dto, user);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user?: User | null,
  ) {
    return this.bookingsService.cancel(id, dto, user);
  }
}
