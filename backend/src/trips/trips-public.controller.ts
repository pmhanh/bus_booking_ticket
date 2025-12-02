import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { TripsService } from './trips.service';
import { SearchTripsDto } from './dto/search-trips.dto';

@Controller('trips')
export class TripsPublicController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('search')
  search(@Query() query: SearchTripsDto) {
    return this.tripsService.searchPublic(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.findPublicById(id);
  }
}
