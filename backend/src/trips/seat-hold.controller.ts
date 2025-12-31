import { Body, Controller, Param, Post } from '@nestjs/common';
import { SeatHoldService } from './seat-hold.service';

@Controller('trips/:tripId/seats')
export class SeatHoldController {
  constructor(private readonly seatHoldService: SeatHoldService) {}

  @Post('hold')
  hold(
    @Param('tripId') tripId: string,
    @Body() dto: { seatCodes: string[]; ttlSeconds?: number },
  ) {
    return this.seatHoldService.holdSeats(+tripId, dto.seatCodes, dto.ttlSeconds);
  }

  @Post('release')
  release(
    @Param('tripId') tripId: string,
    @Body() dto: { seatCodes: string[]; lockToken: string },
  ) {
    return this.seatHoldService.releaseSeats(+tripId, dto.seatCodes, dto.lockToken);
  }
}
