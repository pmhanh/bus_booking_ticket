import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';

type AuthedRequest = Request & { user?: JwtPayload };

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('trips/:tripId/seats')
  seatStatus(@Param('tripId', ParseIntPipe) tripId: number, @Query('lockToken') lockToken?: string) {
    return this.bookingsService.getSeatStatus(tripId, lockToken);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(@Body() dto: CreateBookingDto, @Req() req: AuthedRequest) {
    const user = req.user as JwtPayload | undefined;
    return this.bookingsService.create(dto, user?.sub);
  }

  @Post('guest')
  createGuest(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  listMine(@Req() req: AuthedRequest) {
    const user = req.user as JwtPayload;
    return this.bookingsService.listForUser(user.sub);
  }

  @Get('lookup')
  lookup(@Query() dto: LookupBookingDto) {
    return this.bookingsService.lookup(dto);
  }

  @Get(':reference')
  get(
    @Param('reference') reference: string,
    @Query('email') contactEmail?: string,
    @Query('phone') contactPhone?: string,
  ) {
    return this.bookingsService.getBooking(reference, {
      contactEmail,
      contactPhone,
      requireContactForGuest: true,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':reference')
  update(
    @Param('reference') reference: string,
    @Body() dto: UpdateBookingDto,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user as JwtPayload | undefined;
    return this.bookingsService.updateBooking(reference, dto, user?.sub);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':reference/confirm')
  confirm(
    @Param('reference') reference: string,
    @Req() req: AuthedRequest,
    @Query('email') contactEmail?: string,
    @Query('phone') contactPhone?: string,
  ) {
    const user = req.user as JwtPayload | undefined;
    return this.bookingsService.confirm(reference, {
      userId: user?.sub,
      contactEmail,
      contactPhone,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':reference/cancel')
  cancel(
    @Param('reference') reference: string,
    @Req() req: AuthedRequest,
    @Body() dto: CancelBookingDto,
  ) {
    const user = req.user as JwtPayload | undefined;
    return this.bookingsService.cancel(reference, {
      userId: user?.sub,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
    });
  }

  @Get(':reference/ticket')
  ticket(
    @Param('reference') reference: string,
    @Query('email') contactEmail?: string,
    @Query('phone') contactPhone?: string,
  ) {
    return this.bookingsService.ticketContent(reference, {
      contactEmail,
      contactPhone,
      requireContactForGuest: true,
    });
  }

  @Post(':reference/send-ticket')
  sendTicket(
    @Param('reference') reference: string,
    @Query('email') contactEmail?: string,
    @Query('phone') contactPhone?: string,
  ) {
    return this.bookingsService.sendTicket(reference, {
      contactEmail,
      contactPhone,
      requireContactForGuest: true,
    });
  }
}
