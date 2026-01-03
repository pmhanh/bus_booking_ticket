import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from '../reports/reports.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  async getWidgets(@CurrentUser() user: JwtPayload) {
    const report = await this.reportsService.getAdminSummary({ days: 7 });
    return {
      user,
      summary: report.dashboardSummary,
      activity: [
        { id: 1, message: 'Đơn đặt mới từ Mai Nguyễn', time: '5 phút trước' },
        { id: 2, message: 'Tuyến HN - HCM trễ 10 phút', time: '32 phút trước' },
        { id: 3, message: 'Thêm nhà xe đối tác mới: Sunrise', time: '1 giờ trước' },
      ],
      routes: [
        { route: 'Hà Nội → Đà Nẵng', occupancy: 0.78 },
        { route: 'HCM → Cần Thơ', occupancy: 0.61 },
        { route: 'Đà Nẵng → Huế', occupancy: 0.52 },
      ],
    };
  }

  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin-metrics')
  adminMetrics() {
    return {
      auditsThisWeek: 12,
      bannedUsers: 2,
      flaggedPayments: 1,
    };
  }
}
