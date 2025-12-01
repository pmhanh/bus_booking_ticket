import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Post('sync')
  sync() {
    return this.citiesService.syncFromProvincesApiV2();
  }

  @Get()
  list() {
    return this.citiesService.findAll();
  }

  @Get('search')
  search(@Query('q') q = '', @Query('limit') limit?: string) {
    return this.citiesService.search(q, limit ? Number(limit) : 10);
  }
}
