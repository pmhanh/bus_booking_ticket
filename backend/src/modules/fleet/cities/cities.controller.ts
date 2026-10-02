import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { Roles } from '../../../core/decorators/roles.decorator';
import { FilterCityDto } from './dto/filter-city.dto';

@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('sync')
  sync() {
    return this.citiesService.syncFromProvincesApiV2();
  }

  @Get()
  findAll(@Query() filter: FilterCityDto) {
    return this.citiesService.findAll(filter);
  }
}
