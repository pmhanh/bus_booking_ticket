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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TripSeatsService } from './trip-seats.service';
import { LockSeatsDto } from './dto/lock-seats.dto';
import { RefreshLockDto } from './dto/refresh-lock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

type AuthedRequest = Request & { user?: JwtPayload };

@Controller('trips/:tripId')
export class TripSeatsController {
  constructor(private readonly tripSeatsService: TripSeatsService) {}

  @Get('seat-map')
  getSeatMap(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Query('lockToken') lockToken?: string,
  ) {
    return this.tripSeatsService.getSeatMap(tripId, lockToken);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('seat-locks')
  lockSeats(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: LockSeatsDto,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user as JwtPayload | undefined;
    return this.tripSeatsService.lockSeats(tripId, dto, user?.sub);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch('seat-locks/:token')
  refreshLock(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('token') token: string,
    @Body() dto: RefreshLockDto,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user as JwtPayload | undefined;
    return this.tripSeatsService.refreshLock(tripId, token, dto, user?.sub);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Delete('seat-locks/:token')
  releaseLock(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('token') token: string,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user as JwtPayload | undefined;
    return this.tripSeatsService.releaseLock(tripId, token, user?.sub);
  }
}
