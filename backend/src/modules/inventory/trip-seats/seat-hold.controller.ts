import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { SeatHoldService } from './seat-hold.service';
import { HoldSeatsDto } from './dto/hold-seats.dto';
import { ReleaseSeatsDto } from './dto/release-seats.dto';

@Controller('trips/:tripId/seats')
export class SeatHoldController {
  constructor(private readonly seatHoldService: SeatHoldService) {}

  @Post('hold')
  hold(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: HoldSeatsDto,
  ) {
    return this.seatHoldService.holdSeats(
      tripId,
      dto.seatCodes,
      dto.ttlSeconds,
    );
  }

  @Post('release')
  release(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: ReleaseSeatsDto,
  ) {
    return this.seatHoldService.releaseSeats(
      tripId,
      dto.seatCodes,
      dto.lockToken,
    );
  }
}
