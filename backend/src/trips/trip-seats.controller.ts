import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { TripSeatsService } from './trip-seats.service';

@Controller('trips/:tripId')
export class TripSeatsController {
  constructor(private readonly tripSeatsService: TripSeatsService) {}

  @Get('seat-map')
  getSeatMap(
    @Param('tripId', ParseIntPipe) tripId: number,
  ) {
    return this.tripSeatsService.getSeatMap(tripId);
  }

  // Alias để FE lấy trạng thái ghế: /trips/:tripId/seats/status
  @Get('seats/status')
  getSeatStatus(
    @Param('tripId', ParseIntPipe) tripId: number,
  ) {
    return this.tripSeatsService.getSeatMap(tripId);
  }
}
