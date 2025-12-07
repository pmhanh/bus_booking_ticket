import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload';

type AuthedRequest = Request & { user?: JwtPayload };

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateBookingDto, @Req() req: AuthedRequest) {
    const user = req.user as JwtPayload;
    return this.bookingsService.create(dto, user.sub);
  }

  @Post('guest')
  createGuest(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  @Get(':reference')
  get(@Param('reference') reference: string) {
    return this.bookingsService.getByReference(reference);
  }

  @Post('lookup')
  lookup(@Body() dto: LookupBookingDto) {
    return this.bookingsService.lookup(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':reference/confirm')
  confirm(@Param('reference') reference: string, @Req() req: AuthedRequest) {
    const user = req.user as JwtPayload;
    return this.bookingsService.confirm(reference, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':reference/cancel')
  cancel(@Param('reference') reference: string, @Req() req: AuthedRequest) {
    const user = req.user as JwtPayload;
    return this.bookingsService.cancel(reference, user.sub);
  }

  @Get(':reference/ticket')
  ticket(@Param('reference') reference: string) {
    return this.bookingsService.ticketContent(reference);
  }

  @Post(':reference/send-ticket')
  sendTicket(@Param('reference') reference: string) {
    return this.bookingsService.sendTicket(reference);
  }
}
