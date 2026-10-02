import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BookingsService } from '../bookings.service';
import {
  CreateBookingDto,
  LookupBookingDto,
  UpdateBookingDto,
  CancelBookingDto,
} from '../dto/booking.dto';

import { JwtAuthGuard } from '../../../../core/guards/jwt-auth.guard';
import { JwtPayload } from '../../../../core/interfaces/jwt-payload';
import { OptionalJwtAuthGuard } from '../../../../core/guards/optional-jwt-auth.guard';

type AuthedRequest = Request & { user: JwtPayload };
type OptionallyAuthedRequest = Request & { user?: JwtPayload };

@Controller('bookings')
export class BookingsClientController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(@Body() dto: CreateBookingDto, @Req() req: OptionallyAuthedRequest) {
    return this.bookingsService.create(dto, req.user?.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  listMine(@Req() req: AuthedRequest) {
    return this.bookingsService.listForUser(req.user.sub);
  }

  @Get('lookup')
  lookup(@Query() dto: LookupBookingDto) {
    return this.bookingsService.lookup(dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':reference')
  get(
    @Param('reference') reference: string,
    @Req() req: OptionallyAuthedRequest,
    @Query('email') contactEmail?: string,
    @Query('phone') contactPhone?: string,
  ) {
    return this.bookingsService.getBooking(reference, {
      userId: req.user?.sub,
      contactEmail,
      contactPhone,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':reference')
  update(
    @Param('reference') reference: string,
    @Body() dto: UpdateBookingDto,
    @Req() req: OptionallyAuthedRequest,
  ) {
    return this.bookingsService.updateBooking(reference, dto, req.user?.sub);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch(':reference/cancel')
  cancel(
    @Param('reference') reference: string,
    @Req() req: OptionallyAuthedRequest,
    @Body() dto: CancelBookingDto,
  ) {
    const user = req.user;

    return this.bookingsService.cancel(
      reference,
      {
        userId: user?.sub,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
      },
      dto.pendingOnly,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':reference/ticket')
  ticket(
    @Param('reference') reference: string,
    @Req() req: OptionallyAuthedRequest,
    @Query('email') contactEmail?: string,
    @Query('phone') contactPhone?: string,
  ) {
    return this.bookingsService.ticketContent(reference, {
      userId: req.user?.sub,
      contactEmail,
      contactPhone,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post(':reference/send-ticket')
  sendTicket(
    @Param('reference') reference: string,
    @Req() req: OptionallyAuthedRequest,
    @Query('email') contactEmail?: string,
    @Query('phone') contactPhone?: string,
  ) {
    return this.bookingsService.sendTicket(reference, {
      userId: req.user?.sub,
      contactEmail,
      contactPhone,
    });
  }
}
