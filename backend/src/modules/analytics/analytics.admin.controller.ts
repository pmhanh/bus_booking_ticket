import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { ReportsService } from './reports.service';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AnalyticsAdminController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('admin/reports/summary')
  summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
  ) {
    return this.reportsService.getAdminSummary({
      from,
      to,
      days: days ? Number(days) : undefined,
    });
  }
}
