import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { TripSeatsService } from './trip-seats.service';

@Controller('trips/:tripId/seats')
export class TripSeatsController {
  constructor(private readonly tripSeatsService: TripSeatsService) {}

  @Get('status')
  getSeatStatus(
    @Param('tripId', ParseIntPipe) tripId: number,
  ) {
    return this.tripSeatsService.getSeatMap(tripId);
  }
}
