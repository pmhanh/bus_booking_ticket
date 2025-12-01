import { Controller, Get, Query } from '@nestjs/common';
import { CitiesService } from './cities.service';

@Controller('cities')
export class CitiesPublicController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  list() {
    return this.citiesService.findAll();
  }

  @Get('search')
  search(@Query('q') q = '', @Query('limit') limit?: string) {
    return this.citiesService.search(q, limit ? Number(limit) : 10);
  }
}
